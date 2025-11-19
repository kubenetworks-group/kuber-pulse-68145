import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DockerHubTag {
  name: string;
  last_updated: string;
}

interface DockerHubResponse {
  results: DockerHubTag[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying Docker image: ${image}`);

    // Parse image (e.g., "nginx:1.19", "library/nginx:1.19", "myuser/myapp:v1.0")
    const parts = image.split(':');
    const imageNamePart = parts[0];
    const requestedTag = parts[1] || 'latest';

    // Handle library images (e.g., nginx -> library/nginx)
    let namespace = 'library';
    let repository = imageNamePart;
    
    if (imageNamePart.includes('/')) {
      const nameParts = imageNamePart.split('/');
      namespace = nameParts[0];
      repository = nameParts[1];
    }

    console.log(`Checking Docker Hub for ${namespace}/${repository}:${requestedTag}`);

    // Query Docker Hub API
    const dockerHubUrl = `https://hub.docker.com/v2/repositories/${namespace}/${repository}/tags?page_size=100`;
    
    const response = await fetch(dockerHubUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            exists: false, 
            error: 'image_not_found',
            message: `Imagem ${namespace}/${repository} não encontrada no Docker Hub` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Docker Hub API error: ${response.status}`);
    }

    const data: DockerHubResponse = await response.json();
    const availableTags = data.results.map(t => t.name);

    console.log(`Found ${availableTags.length} tags for ${namespace}/${repository}`);

    // Check if requested tag exists
    const tagExists = availableTags.includes(requestedTag);

    if (tagExists) {
      return new Response(
        JSON.stringify({ 
          exists: true, 
          image: `${namespace === 'library' ? repository : `${namespace}/${repository}`}:${requestedTag}`,
          message: 'Imagem existe no Docker Hub'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tag doesn't exist - find closest match
    console.log(`Tag ${requestedTag} not found. Finding closest match...`);
    
    // Try to find similar versions
    const suggestedTag = findClosestTag(requestedTag, availableTags);

    return new Response(
      JSON.stringify({ 
        exists: false,
        error: 'tag_not_found',
        requested_tag: requestedTag,
        suggested_tag: suggestedTag,
        suggested_image: `${namespace === 'library' ? repository : `${namespace}/${repository}`}:${suggestedTag}`,
        available_tags: availableTags.slice(0, 10), // Return first 10 tags
        message: `Tag ${requestedTag} não existe. Sugestão: ${suggestedTag}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying Docker image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function findClosestTag(requestedTag: string, availableTags: string[]): string {
  // If requested tag is a version number, try to find closest version
  const versionMatch = requestedTag.match(/^v?(\d+)\.?(\d+)?\.?(\d+)?/);
  
  if (versionMatch) {
    const [_, major, minor, patch] = versionMatch;
    
    // Try exact matches with different formats
    const variations = [
      requestedTag,
      `v${major}${minor ? `.${minor}` : ''}${patch ? `.${patch}` : ''}`,
      `${major}${minor ? `.${minor}` : ''}${patch ? `.${patch}` : ''}`,
      `${major}${minor ? `.${minor}` : ''}`,
      `${major}`,
      'latest',
      'stable'
    ];

    for (const variation of variations) {
      if (availableTags.includes(variation)) {
        return variation;
      }
    }

    // Find similar major version
    const similarTags = availableTags.filter(tag => {
      const tagMatch = tag.match(/^v?(\d+)\.?(\d+)?\.?(\d+)?/);
      if (tagMatch && tagMatch[1] === major) {
        return true;
      }
      return false;
    });

    if (similarTags.length > 0) {
      // Return the first similar tag (usually sorted by Docker Hub)
      return similarTags[0];
    }
  }

  // Fallback: return latest or first available tag
  if (availableTags.includes('latest')) {
    return 'latest';
  }
  if (availableTags.includes('stable')) {
    return 'stable';
  }
  
  return availableTags[0] || 'latest';
}
