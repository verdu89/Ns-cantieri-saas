import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<
    HTMLElement | Window | null
  >(null);

  useEffect(() => {
    const onScroll = (e: Event) => {
      let scrollTop = 0;

      if (e.target instanceof Window) {
        scrollTop =
          window.pageYOffset ||
          document.documentElement.scrollTop ||
          document.body.scrollTop;
      } else if (e.target instanceof HTMLElement) {
        scrollTop = e.target.scrollTop;
        setScrollContainer(e.target);
      }

      setVisible(scrollTop > 120); // appare dopo 120px
    };

    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  const scrollToTop = () => {
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!visible) return null;

  const bottomOffset = Capacitor.isNativePlatform()
    ? "max(24px, calc(env(safe-area-inset-bottom, 0px) + 12px))"
    : "24px";

  return (
    <button
      onClick={scrollToTop}
      aria-label="Torna su"
      style={{
        position: "fixed",
        bottom: bottomOffset,
        right: "24px",
        zIndex: 9999,
        backgroundColor: "#f3f4f6", // grigio chiaro (Tailwind gray-100)
        color: "#374151", // icona grigio scuro (slate-700)
        border: "none",
        borderRadius: "50%", // rotondo moderno (FAB style)
        width: "48px",
        height: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "#e5e7eb"; // hover gray-200
        (e.currentTarget as HTMLButtonElement).style.transform =
          "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "#f3f4f6";
        (e.currentTarget as HTMLButtonElement).style.transform =
          "translateY(0)";
      }}
    >
      {/* freccia elegante SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#374151"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
