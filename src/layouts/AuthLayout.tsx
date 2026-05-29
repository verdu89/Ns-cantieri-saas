import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

const AuthLayoutFullBg = () => {
  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      {/* Sfondo immagine con movimento leggero */}
      <motion.img
        src="/cantiere.jpg"
        alt="Montaggio in cantiere"
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      {/* Overlay gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80" />

      {/* Contenuto centrale */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-2 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="
            w-full 
            max-w-full sm:max-w-md lg:max-w-lg
            p-4 sm:p-8 lg:p-10 
            bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl 
            shadow-[0_0_40px_rgba(0,0,0,0.6)] 
            min-h-[90vh] sm:min-h-fit 
            flex flex-col justify-center
            overflow-y-auto
          "
        >
          {/* Header (Logo + Titolo) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center mb-6 sm:mb-8 text-center"
          >
            <motion.img
              src={logo}
              alt="Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 mb-4 drop-shadow-lg"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white drop-shadow-md tracking-wide">
              Benvenuto in NS cantieri
            </h1>
            <p className="mt-2 text-gray-300 text-sm sm:text-base lg:text-lg">
              Gestione Montaggi & Back Office
            </p>
          </motion.div>

          {/* Outlet con le pagine figlie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex-1"
          >
            <Outlet />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayoutFullBg;
