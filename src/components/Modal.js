"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.css";

export default function Modal({ isOpen, onClose, title, children }) {
    const portalRef = useRef(null);

    useEffect(() => {
        if (typeof document !== "undefined") {
            portalRef.current = document.body;
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        // Lock body scroll + hide bottom nav while modal open
        document.body.style.overflow = "hidden";
        document.body.classList.add("modal-open");
        return () => {
            document.body.style.overflow = "";
            document.body.classList.remove("modal-open");
        };
    }, [isOpen]);

    if (!isOpen || typeof document === "undefined") return null;

    const modal = (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
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
