export const Footer = () => {
  return (
    <footer className="border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} KubeNetworks. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
};
