"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ isOpen, onClose, title, children }) {
    const portalRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof document !== "undefined") {
            portalRef.current = document.body;
        }
        if (typeof window !== "undefined") {
            setIsMobile(window.innerWidth < 768);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        // Only add class for bottom-nav hiding; avoid overflow:hidden on body
        // which can break position:fixed children on iOS WebView
        document.body.classList.add("modal-open");
        return () => {
            document.body.classList.remove("modal-open");
        };
    }, [isOpen]);

    if (!isOpen || typeof document === "undefined") return null;

    // On mobile: enforce scrollable sheet with guaranteed bottom clearance
    const mobileSheetStyle = isMobile ? {
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        maxHeight: "88dvh",
        borderRadius: "24px 24px 0 0",
        padding: "20px 16px 80px 16px",
    } : {};

    const modal = (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content card" style={mobileSheetStyle} onClick={(e) => e.stopPropagation()}>
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
