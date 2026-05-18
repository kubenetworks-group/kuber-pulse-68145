import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedDate?: string;
  tags?: string[];
}

const BASE_URL = "https://kodo.kubenetworks.com.br";

export const SEO = ({ title, description, path, type = "website", publishedDate, tags }: SEOProps) => {
  const url = `${BASE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Kodo" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {publishedDate && <meta property="article:published_time" content={publishedDate} />}
      {publishedDate && <meta property="article:author" content="Kodo — KubeNetworks" />}
      {tags && <meta property="article:section" content="Kubernetes" />}
      {tags && tags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}
    </Helmet>
  );
};
