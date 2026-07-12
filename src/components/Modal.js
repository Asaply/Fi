"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ isOpen, onClose, title, children }) {
    const portalRef = useRef(null);
    const [viewportHeight, setViewportHeight] = useState(null);
    // Native keyboard height (from @capacitor/keyboard). With Keyboard resize
    // set to `none` the webview no longer shrinks and visualViewport does not
    // report the keyboard, so we lift the bottom sheet by this amount and cap
    // its height to the space above the keyboard — otherwise the lower fields
    // sit behind the keyboard and can't be scrolled into view.
    const [kbHeight, setKbHeight] = useState(0);

    useEffect(() => {
        if (typeof document !== "undefined") {
            portalRef.current = document.body;
        }
    }, []);

    // Track visual viewport for keyboard-aware sizing on iOS
    const updateHeight = useCallback(() => {
        if (typeof window !== "undefined" && window.visualViewport) {
            setViewportHeight(window.visualViewport.height);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        document.body.classList.add("modal-open");

        // Listen to visualViewport resize (keyboard show/hide on web)
        const vv = typeof window !== "undefined" ? window.visualViewport : null;
        if (vv) {
            updateHeight();
            vv.addEventListener("resize", updateHeight);
        }

        // Native keyboard events (Capacitor) — the reliable signal with resize:none
        let removeShow, removeHide;
        const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
        if (isNative) {
            import("@capacitor/keyboard").then(({ Keyboard }) => {
                Keyboard.addListener("keyboardWillShow", (info) => setKbHeight(info?.keyboardHeight || 0))
                    .then((h) => { removeShow = () => h.remove(); });
                Keyboard.addListener("keyboardWillHide", () => setKbHeight(0))
                    .then((h) => { removeHide = () => h.remove(); });
            }).catch(() => {});
        }

        return () => {
            document.body.classList.remove("modal-open");
            if (vv) vv.removeEventListener("resize", updateHeight);
            removeShow?.();
            removeHide?.();
            setKbHeight(0);
        };
    }, [isOpen, updateHeight]);

    if (!isOpen || typeof document === "undefined") return null;

    // Dynamic styles for keyboard-aware modal
    const backdropStyle = viewportHeight
        ? { height: `${viewportHeight}px` }
        : {};

    // When the native keyboard is up, lift the sheet above it and shrink it so
    // the body scrolls; otherwise fall back to visualViewport-based sizing.
    const contentStyle = kbHeight > 0
        ? {
            maxHeight: `${(typeof window !== "undefined" ? window.innerHeight : 800) - kbHeight - 24}px`,
            marginBottom: `${kbHeight}px`,
        }
        : viewportHeight
            ? { maxHeight: `${viewportHeight * 0.85}px` }
            : {};

    const modal = (
        <div className="modal-backdrop" style={backdropStyle} onClick={onClose}>
            <div className="modal-content card" style={contentStyle} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="icon-btn close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
