import {
    RefreshCw, ShoppingCart, Utensils, Car, ArrowLeftRight, TrendingUp,
    Zap, GraduationCap, Banknote, HeartPulse, ShoppingBag, Film, Home,
    Wallet, Briefcase, Tag, ArrowDownLeft, Percent, Undo2, Gift, Plane,
    Dumbbell, Baby, PawPrint, Wrench, Coffee, MoreHorizontal, ShieldCheck,
} from 'lucide-react';

// Category → lucide icon. Matches substrings so AI-generated variants still map.
const RULES = [
    [/suscrip/i, RefreshCw],
    [/restaurant|café|cafe|comida rápida|comida rapida/i, Utensils],
    [/super|comida|abarrot|despensa|groceries/i, ShoppingCart],
    [/transporte|gasolina|uber|taxi|auto|transport/i, Car],
    [/transferenc/i, ArrowLeftRight],
    [/inversi/i, TrendingUp],
    [/servici.*(luz|agua|internet)|luz|agua|internet|cfe|telmex|servicios/i, Zap],
    [/educaci|escuela|colegiatura|universidad/i, GraduationCap],
    [/retiro.*efectivo|cajero|efectivo/i, Banknote],
    [/salud|farmacia|médic|medic|hospital/i, HeartPulse],
    [/compra|tienda|shopping|ropa/i, ShoppingBag],
    [/entreteni|cine|streaming|juego/i, Film],
    [/hogar|renta|casa|mueble/i, Home],
    [/nómina|nomina|salario|sueldo/i, Wallet],
    [/freelance|honorario|servicio profes/i, Briefcase],
    [/venta/i, Tag],
    [/spei recibido|recibido|depósito|deposito/i, ArrowDownLeft],
    [/interes|rendimiento/i, Percent],
    [/devoluci|reembolso|bonific/i, Undo2],
    [/regalo|gift/i, Gift],
    [/viaje|vuelo|hotel|travel|hospedaje/i, Plane],
    [/seguro|póliza|poliza/i, ShieldCheck],
    [/gym|gimnasio|deporte|fitness/i, Dumbbell],
    [/bebé|bebe|niñ/i, Baby],
    [/mascota|veterinar|pet/i, PawPrint],
    [/reparaci|manteni|herramient/i, Wrench],
    [/otros gastos/i, MoreHorizontal],
    [/coffee|starbucks/i, Coffee],
];

export function getCategoryIcon(name = '') {
    for (const [re, Icon] of RULES) if (re.test(name)) return Icon;
    return Tag;
}
