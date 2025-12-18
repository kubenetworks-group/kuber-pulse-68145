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

interface VerificationResult {
  exists: boolean;
  error?: string;
  image?: string;
  message: string;
  requested_tag?: string;
  suggested_tag?: string;
  suggested_image?: string;
  available_tags?: string[];
  fix_type?: 'tag_only' | 'repository_only' | 'full_image';
  original_version_available?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, deployment_image } = await req.json();
    
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying Docker image: ${image}`);
    if (deployment_image) {
      console.log(`Current deployment image: ${deployment_image}`);
    }

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

    // First, try the exact repository
    let result = await checkRepository(namespace, repository, requestedTag);
    
    if (result.exists) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If repository not found, try to find similar repositories
    if (result.error === 'image_not_found') {
      console.log(`Repository ${namespace}/${repository} not found. Trying alternatives...`);
      
      // Try library namespace if it was a custom namespace
      if (namespace !== 'library') {
        const libraryResult = await checkRepository('library', repository, requestedTag);
        if (!libraryResult.error || libraryResult.error !== 'image_not_found') {
          result = libraryResult;
          result.fix_type = 'repository_only';
          result.message = `Repositório "${namespace}/${repository}" não existe. Use "${repository}" (imagem oficial).`;
        }
      }
      
      // Try common typo fixes
      const typoFixes = getCommonTypoFixes(repository);
      for (const fixedRepo of typoFixes) {
        const fixResult = await checkRepository(namespace, fixedRepo, requestedTag);
        if (!fixResult.error || fixResult.error !== 'image_not_found') {
          result = fixResult;
          result.fix_type = 'repository_only';
          result.message = `Repositório "${repository}" não existe. Você quis dizer "${fixedRepo}"?`;
          break;
        }
        
        // Also try in library namespace
        if (namespace !== 'library') {
          const libFixResult = await checkRepository('library', fixedRepo, requestedTag);
          if (!libFixResult.error || libFixResult.error !== 'image_not_found') {
            result = libFixResult;
            result.fix_type = 'repository_only';
            result.message = `Repositório "${namespace}/${repository}" não existe. Use "${fixedRepo}" (imagem oficial).`;
            break;
          }
        }
      }
    }

    // If tag not found but repository exists, try to preserve the version
    if (result.error === 'tag_not_found' && result.available_tags) {
      const availableTags = result.available_tags;
      
      // Extract version number from requested tag
      const versionMatch = requestedTag.match(/(\d+)\.?(\d+)?\.?(\d+)?/);
      
      if (versionMatch) {
        const [fullMatch, major, minor, patch] = versionMatch;
        
        // Try to find exact version in available tags
        const exactVersionTags = availableTags.filter(tag => {
          const tagVersion = tag.match(/(\d+)\.?(\d+)?\.?(\d+)?/);
          if (!tagVersion) return false;
          
          // Check if major version matches
          if (tagVersion[1] !== major) return false;
          
          // If minor was specified, check it
          if (minor && tagVersion[2] && tagVersion[2] !== minor) return false;
          
          // If patch was specified, check it
          if (patch && tagVersion[3] && tagVersion[3] !== patch) return false;
          
          return true;
        });
        
        if (exactVersionTags.length > 0) {
          // Sort to get the most specific match
          exactVersionTags.sort((a, b) => b.length - a.length);
          result.suggested_tag = exactVersionTags[0];
          result.original_version_available = true;
          result.fix_type = 'tag_only';
          result.message = `Tag "${requestedTag}" não existe, mas a versão ${major}${minor ? '.' + minor : ''} está disponível como "${exactVersionTags[0]}"`;
        } else {
          // No exact version, find closest major version
          const sameMajorTags = availableTags.filter(tag => {
            const tagVersion = tag.match(/^v?(\d+)/);
            return tagVersion && tagVersion[1] === major;
          });
          
          if (sameMajorTags.length > 0) {
            result.suggested_tag = sameMajorTags[0];
            result.fix_type = 'tag_only';
            result.message = `Tag "${requestedTag}" não existe. Versão ${major}.x disponível: "${sameMajorTags[0]}"`;
          } else {
            result.suggested_tag = findClosestTag(requestedTag, availableTags);
            result.fix_type = 'full_image';
            result.message = `Tag "${requestedTag}" não existe. Sugestão: "${result.suggested_tag}"`;
          }
        }
      }
      
      // Update suggested_image with the best tag
      const finalNamespace = result.suggested_image?.split('/')[0] || namespace;
      const finalRepo = result.suggested_image?.split('/').pop()?.split(':')[0] || repository;
      result.suggested_image = finalNamespace === 'library' 
        ? `${finalRepo}:${result.suggested_tag}`
        : `${finalNamespace}/${finalRepo}:${result.suggested_tag}`;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error verifying Docker image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkRepository(namespace: string, repository: string, requestedTag: string): Promise<VerificationResult> {
  const dockerHubUrl = `https://hub.docker.com/v2/repositories/${namespace}/${repository}/tags?page_size=100`;
  
  try {
    const response = await fetch(dockerHubUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          exists: false,
          error: 'image_not_found',
          message: `Imagem ${namespace}/${repository} não encontrada no Docker Hub`
        };
      }
      throw new Error(`Docker Hub API error: ${response.status}`);
    }

    const data: DockerHubResponse = await response.json();
    const availableTags = data.results.map(t => t.name);

    console.log(`Found ${availableTags.length} tags for ${namespace}/${repository}`);

    // Check if requested tag exists
    const tagExists = availableTags.includes(requestedTag);

    if (tagExists) {
      return {
        exists: true,
        image: `${namespace === 'library' ? repository : `${namespace}/${repository}`}:${requestedTag}`,
        message: 'Imagem existe no Docker Hub'
      };
    }

    // Tag doesn't exist - return with available tags for further processing
    const suggestedTag = findClosestTag(requestedTag, availableTags);

    return {
      exists: false,
      error: 'tag_not_found',
      requested_tag: requestedTag,
      suggested_tag: suggestedTag,
      suggested_image: `${namespace === 'library' ? repository : `${namespace}/${repository}`}:${suggestedTag}`,
      available_tags: availableTags.slice(0, 20),
      message: `Tag ${requestedTag} não existe. Sugestão: ${suggestedTag}`
    };
  } catch (error) {
    console.error(`Error checking repository ${namespace}/${repository}:`, error);
    return {
      exists: false,
      error: 'api_error',
      message: `Erro ao verificar repositório: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

function getCommonTypoFixes(repository: string): string[] {
  const fixes: string[] = [];
  const lower = repository.toLowerCase();
  
  // Common typos and alternatives
  const typoMap: Record<string, string[]> = {
    'ngnix': ['nginx'],
    'ngix': ['nginx'],
    'nginix': ['nginx'],
    'postgress': ['postgres'],
    'postgresql': ['postgres'],
    'mysql': ['mysql', 'mariadb'],
    'redis': ['redis'],
    'mongo': ['mongo'],
    'mongodb': ['mongo'],
    'node': ['node'],
    'nodejs': ['node'],
    'python': ['python'],
    'python3': ['python'],
    'alpine': ['alpine'],
    'ubuntu': ['ubuntu'],
    'debian': ['debian'],
    'centos': ['centos'],
    'busybox': ['busybox'],
  };
  
  // Check direct typo matches
  if (typoMap[lower]) {
    fixes.push(...typoMap[lower]);
  }
  
  // Check if repository contains a typo
  for (const [typo, corrections] of Object.entries(typoMap)) {
    if (lower.includes(typo) && typo !== lower) {
      for (const correction of corrections) {
        fixes.push(lower.replace(typo, correction));
      }
    }
  }
  
  return [...new Set(fixes)];
}

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
