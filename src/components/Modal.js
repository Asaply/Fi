"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ isOpen, onClose, title, children }) {
    const portalRef = useRef(null);
    const [viewportHeight, setViewportHeight] = useState(null);

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

        // Listen to visualViewport resize (keyboard show/hide)
        const vv = typeof window !== "undefined" ? window.visualViewport : null;
        if (vv) {
            updateHeight();
            vv.addEventListener("resize", updateHeight);
        }

        return () => {
            document.body.classList.remove("modal-open");
            if (vv) vv.removeEventListener("resize", updateHeight);
        };
    }, [isOpen, updateHeight]);

    if (!isOpen || typeof document === "undefined") return null;

    // Dynamic styles for keyboard-aware modal
    const backdropStyle = viewportHeight
        ? { height: `${viewportHeight}px` }
        : {};

    const contentStyle = viewportHeight
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
