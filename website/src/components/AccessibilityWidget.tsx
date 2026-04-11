import { useState } from "react";

export default function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [disableAnimations, setDisableAnimations] = useState(false);

  const handleFontSize = (change: number) => {
    const newSize = Math.max(80, Math.min(150, fontSize + change));
    setFontSize(newSize);
    document.documentElement.style.fontSize = (newSize / 100) * 16 + "px";
  };

  const handleHighContrast = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    if (newValue) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
  };

  const handleDisableAnimations = () => {
    const newValue = !disableAnimations;
    setDisableAnimations(newValue);
    if (newValue) {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center justify-center"
        aria-label="נגישות"
        aria-expanded={isOpen}
        aria-controls="accessibility-menu"
      >
        <span className="material-symbols-outlined text-2xl">accessibility</span>
      </button>

      {/* Accessibility menu */}
      {isOpen && (
        <div
          id="accessibility-menu"
          className="fixed bottom-24 left-6 z-40 bg-white rounded-lg shadow-xl p-5 w-64 border-2 border-primary"
        >
          <h2 className="font-headline font-bold text-primary text-sm mb-4">אפשרויות נגישות</h2>

          {/* Font size controls */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-on-surface-variant mb-2">גודל טקסט</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFontSize(-10)}
                className="px-3 py-1 bg-surface-container rounded text-xs font-bold hover:bg-surface-container-high transition-colors"
                aria-label="הקטן טקסט"
              >
                A-
              </button>
              <span className="text-xs text-on-surface-variant flex-1 text-center">{fontSize}%</span>
              <button
                onClick={() => handleFontSize(10)}
                className="px-3 py-1 bg-surface-container rounded text-xs font-bold hover:bg-surface-container-high transition-colors"
                aria-label="הגדל טקסט"
              >
                A+
              </button>
            </div>
          </div>

          {/* High contrast toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={highContrast}
                onChange={handleHighContrast}
                className="w-4 h-4 rounded"
                aria-label="ניגודיות גבוהה"
              />
              <span className="text-xs font-medium text-on-surface">ניגודיות גבוהה</span>
            </label>
          </div>

          {/* Disable animations toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={disableAnimations}
                onChange={handleDisableAnimations}
                className="w-4 h-4 rounded"
                aria-label="השבת אנימציות"
              />
              <span className="text-xs font-medium text-on-surface">השבת אנימציות</span>
            </label>
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 px-3 py-2 bg-surface-container text-on-surface-variant text-xs font-medium rounded hover:bg-surface-container-high transition-colors"
          >
            סגור
          </button>
        </div>
      )}

      {/* High contrast styles */}
      <style>{`
        :root.high-contrast {
          color-scheme: dark;
        }

        :root.high-contrast * {
          border-color: #000 !important;
        }

        :root.high-contrast {
          --md-sys-color-primary: #000;
          --md-sys-color-on-primary: #fff;
          --md-sys-color-background: #fff;
          --md-sys-color-on-background: #000;
          --md-sys-color-surface: #fff;
          --md-sys-color-on-surface: #000;
          --md-sys-color-outline: #000;
        }

        /* Reduce motion styles */
        :root.reduce-motion *,
        :root.reduce-motion *::before,
        :root.reduce-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </>
  );
}
