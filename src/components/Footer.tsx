const Footer = () => {
  return (
    <footer className="bg-gray-800 text-gray-200 py-4 text-center mt-auto">
      <p className="text-sm">
        © {new Date().getFullYear()} Ns-cantieri · Tutti i diritti riservati
      </p>
    </footer>
  );
};

export default Footer;
