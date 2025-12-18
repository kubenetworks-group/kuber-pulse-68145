import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Phone, Mail, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-[#0a1628] text-white mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">KUBE NETWORKS</h3>
            <p className="text-sm text-gray-300">
              Soluções em cloud para negócios eficientes e seguros.
            </p>
            <div className="flex items-center gap-4">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links Rápidos */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Links Rápidos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link to="/#features" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Serviços
                </Link>
              </li>
              <li>
                <Link to="/#about" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Sobre
                </Link>
              </li>
              <li>
                <a href="mailto:denercavalcante@kubenetworks.com.br" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </div>

          {/* Serviços */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Serviços</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-gray-300">Kubernetes</span>
              </li>
              <li>
                <span className="text-sm text-gray-300">Cloud Computing</span>
              </li>
              <li>
                <span className="text-sm text-gray-300">DevOps</span>
              </li>
              <li>
                <span className="text-sm text-gray-300">Consultoria</span>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Contato</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-300" />
                <a href="tel:+5511988917172" className="text-sm text-gray-300 hover:text-white transition-colors">
                  +55 11 98891-7172
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-300" />
                <a href="mailto:denercavalcante@kubenetworks.com.br" className="text-sm text-gray-300 hover:text-white transition-colors">
                  denercavalcante@kubenetworks.com.br
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-300" />
                <span className="text-sm text-gray-300">São Paulo, SP - Brasil</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <p className="text-center text-sm text-gray-400">
            © {new Date().getFullYear()} KubeNetworks. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
