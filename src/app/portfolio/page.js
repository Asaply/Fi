"use client";
import { useState } from "react";
import useSWR from "swr";
import { User, Activity, Settings, TrendingUp, BarChart2, Plus, Edit2, Trash2, DollarSign, Target, Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import "./Portfolio.css";

// --- FETCH LOGIC ---
const fetchPrices = async (assets) => {
    const uniqueAssets = [...new Map(assets.map(a => [a.ticker.toUpperCase(), a])).values()];
    const prices = {};
    
    await Promise.all(uniqueAssets.map(async (asset) => {
        let endpoint = '';
        const cat = asset.category.toLowerCase();
        if (cat === 'crypto') {
            endpoint = `/api/crypto?ticker=${asset.ticker}`;
        } else if (['stock', 'etf', 'bond', 'bono', 'acciones'].includes(cat)) {
            endpoint = `/api/price?ticker=${asset.ticker}`;
        }
        
        if (!endpoint) return;
        
        try {
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                if (data.price) prices[asset.ticker.toUpperCase()] = parseFloat(data.price);
            }
        } catch (e) {
            console.error(`Failed to fetch price for ${asset.ticker}`, e);
        }
    }));
    return prices;
};

const fetchPortfolioData = async () => {
    const { data: assets, error } = await supabase.from('portfolio_assets').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("Supabase Error:", error);
        return { assets: [], prices: {} };
    }
    const prices = await fetchPrices(assets || []);
    return { assets: assets || [], prices };
};

// --- CONSTANTS ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

export default function PortfolioHealth() {
    const { data, error, isLoading, mutate } = useSWR('portfolio_data', fetchPortfolioData, { refreshInterval: 60000 });
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    const [formData, setFormData] = useState({
        ticker: "", category: "Stock", quantity: "", avg_buy_price: "", buy_date: new Date().toISOString().split('T')[0], notes: ""
    });

    const openModal = (assetToEdit = null) => {
        if (assetToEdit) {
            setEditingAsset(assetToEdit);
            setFormData({
                ticker: assetToEdit.ticker,
                category: assetToEdit.category,
                quantity: assetToEdit.quantity.toString(),
                avg_buy_price: assetToEdit.avg_buy_price.toString(),
                buy_date: assetToEdit.buy_date,
                notes: assetToEdit.notes || ""
            });
        } else {
            setEditingAsset(null);
            setFormData({ ticker: "", category: "Stock", quantity: "", avg_buy_price: "", buy_date: new Date().toISOString().split('T')[0], notes: "" });
        }
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ticker: formData.ticker.toUpperCase(),
            category: formData.category,
            quantity: parseFloat(formData.quantity) || 0,
            avg_buy_price: parseFloat(formData.avg_buy_price) || 0,
            buy_date: formData.buy_date,
            notes: formData.notes
        };

        if (editingAsset) {
            await supabase.from('portfolio_assets').update(payload).eq('id', editingAsset.id);
        } else {
            await supabase.from('portfolio_assets').insert([payload]);
        }
        
        setIsModalOpen(false);
        mutate(); // Revalidate SWR
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            await supabase.from('portfolio_assets').delete().eq('id', itemToDelete);
            setItemToDelete(null);
            mutate();
        }
    };

    // --- DERIVED METRICS ---
    const assets = data?.assets || [];
    const prices = data?.prices || {};
    
    let totalValue = 0;
    let totalCost = 0;
    let bestAsset = { ticker: '-', pnlPerc: -Infinity };
    let worstAsset = { ticker: '-', pnlPerc: Infinity };
    
    const enrichedAssets = assets.map(asset => {
        const currentPrice = prices[asset.ticker.toUpperCase()];
        const cost = asset.quantity * asset.avg_buy_price;
        let value = cost;
        let pnl = 0;
        let pnlPerc = 0;
        
        if (currentPrice !== undefined) {
            value = asset.quantity * currentPrice;
            pnl = value - cost;
            pnlPerc = cost > 0 ? (pnl / cost) * 100 : 0;
            
            if (pnlPerc > bestAsset.pnlPerc) bestAsset = { ticker: asset.ticker, pnlPerc };
            if (pnlPerc < worstAsset.pnlPerc) worstAsset = { ticker: asset.ticker, pnlPerc };
        }
        
        totalValue += value;
        totalCost += cost;
        
        return { ...asset, currentPrice, value, pnl, pnlPerc, cost };
    });

    const totalPnl = totalValue - totalCost;
    const totalPnlPerc = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // --- CHARTS DATA ---
    const distributionMap = {};
    enrichedAssets.forEach(a => {
        distributionMap[a.category] = (distributionMap[a.category] || 0) + a.value;
    });
    const pieData = Object.keys(distributionMap).map(k => ({ name: k, value: distributionMap[k] }));

    const barData = enrichedAssets.map(a => ({
        name: a.ticker,
        PnL: parseFloat(a.pnl.toFixed(2))
    }));

    // --- HEALTH SCORE ---
    let healthScore = 50; // Base 50
    const recs = [];
    
    if (enrichedAssets.length > 0) {
        // Diversification
        const maxAssetVal = Math.max(...enrichedAssets.map(a => a.value));
        const maxPerc = totalValue > 0 ? (maxAssetVal / totalValue) * 100 : 0;
        if (maxPerc > 60) {
            healthScore -= 15;
            recs.push("High concentration risk: Consider reducing exposure to your top holding.");
        } else if (maxPerc < 20) {
            healthScore += 20;
            recs.push("Excellent diversification detected across assets.");
        }

        // Crypto Exp
        const cryptoVal = enrichedAssets.filter(a => a.category.toLowerCase() === 'crypto').reduce((s, a) => s + a.value, 0);
        const cryptoPerc = totalValue > 0 ? (cryptoVal / totalValue) * 100 : 0;
        if (cryptoPerc > 50) {
            healthScore -= 15;
            recs.push("High crypto exposure: Increases volatility and general risk score.");
        } else if (cryptoPerc > 0 && cryptoPerc <= 20) {
            healthScore += 10;
        }

        // Number of assets
        if (enrichedAssets.length >= 5) {
            healthScore += 10;
            recs.push("Healthy amount of different assets.");
        } else {
            recs.push("Adding more assets could help spread risk.");
        }

        // P&L
        if (totalPnlPerc > 10) healthScore += 15;
        else if (totalPnlPerc > 0) healthScore += 5;
        else if (totalPnlPerc < -10) {
            healthScore -= 10;
            recs.push("Overall negative trend: Consider reviewing underperforming assets.");
        }

        healthScore = Math.min(Math.max(healthScore, 0), 100);
    } else {
        healthScore = 0;
        recs.push("Add some assets to calculate your health score.");
    }

    const getScoreAngle = (score) => {
        return (score / 100) * 180;
    };

    const formatCurrency = (amt) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);

    return (
        <div className="portfolio-container">
            <aside className="portfolio-sidebar">
                <div className="portfolio-sidebar-header">
                    <div className="portfolio-avatar">
                        <User size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Hello, Investor</div>
                    </div>
                </div>
                <div className="portfolio-nav">
                    <div className="p-nav-item"><div className="p-nav-icon"><TrendingUp size={14} /></div><div className="p-nav-text"><span className="p-nav-title">Follow Stocks</span><span className="p-nav-desc">Unlimited breaking news</span></div></div>
                    <div className="p-nav-item"><div className="p-nav-icon"><Settings size={14} /></div><div className="p-nav-text"><span className="p-nav-title">Optimize Portfolio</span><span className="p-nav-desc">Track stocks smarter</span></div></div>
                    <div className="p-nav-item active"><div className="p-nav-icon"><Activity size={14} color="#fff" /></div><div className="p-nav-text"><span className="p-nav-title">Portfolio Health </span><span className="p-nav-desc">Live Tracking & Scores</span></div></div>
                    <div className="p-nav-item"><div className="p-nav-icon" style={{ background: 'transparent' }}><BarChart2 size={14} /></div><div className="p-nav-text"><span className="p-nav-title">AI Reports</span><span className="p-nav-desc">Coming soon</span></div></div>
                </div>
            </aside>

            <main className="portfolio-content">
                <div className="p-header">
                    <h1 className="p-title">Portfolio Dashboard</h1>
                    <button className="btn-primary" onClick={() => openModal()}>
                        <Plus size={16} /> Add Asset
                    </button>
                </div>

                {isLoading && !data ? (
                    <div className="dashboard-metrics">
                        {[1,2,3,4].map(i => <div key={i} className="metric-card skeleton" style={{ height: '100px' }}></div>)}
                    </div>
                ) : (
                    <>
                        <div className="dashboard-metrics">
                            <div className="metric-card">
                                <span className="metric-title"><Briefcase size={14}/> Total Value</span>
                                <span className="metric-value">{formatCurrency(totalValue)}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-title"><DollarSign size={14}/> Total P&L</span>
                                <span className={`metric-value ${totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                                    {totalPnl > 0 ? '+' : ''}{formatCurrency(totalPnl)}
                                </span>
                                <span style={{ fontSize: '13px', color: totalPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {totalPnlPerc > 0 ? '+' : ''}{totalPnlPerc.toFixed(2)}%
                                </span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-title"><TrendingUp size={14}/> Best Asset</span>
                                <span className="metric-value" style={{color: 'var(--success)'}}>{bestAsset.ticker}</span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bestAsset.pnlPerc === -Infinity ? '-' : `+${bestAsset.pnlPerc.toFixed(1)}%`}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-title"><TrendingUp size={14} style={{transform: 'scaleY(-1)'}}/> Worst Asset</span>
                                <span className="metric-value" style={{color: 'var(--danger)'}}>{worstAsset.ticker}</span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{worstAsset.pnlPerc === Infinity ? '-' : `${worstAsset.pnlPerc.toFixed(1)}%`}</span>
                            </div>
                        </div>

                        <div className="health-card">
                            <div className="health-header">
                                <h3 style={{ margin: 0 }}>Portfolio Health Score</h3>
                            </div>
                            <div className="health-grid-inner">
                                <div className="gauge-container">
                                    <svg viewBox="0 0 200 110" style={{ width: '100%', overflow: 'visible' }}>
                                        <path d="M 20 100 A 80 80 0 0 1 70 30" fill="none" stroke="#b91c1c" strokeWidth="20" />
                                        <path d="M 70 30 A 80 80 0 0 1 130 30" fill="none" stroke="#facc15" strokeWidth="20" />
                                        <path d="M 130 30 A 80 80 0 0 1 180 100" fill="none" stroke="#15803d" strokeWidth="20" />
                                        
                                        <line 
                                            x1="100" y1="100" x2="30" y2="100" 
                                            stroke="#fff" strokeWidth="4" strokeLinecap="round"
                                            transform={`rotate(${getScoreAngle(healthScore)}, 100, 100)`}
                                            style={{ transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
                                        />
                                        <circle cx="100" cy="100" r="6" fill="#fff" />
                                    </svg>
                                    <div className="gauge-center-label" style={{ color: healthScore > 70 ? 'var(--success)' : healthScore > 40 ? '#facc15' : 'var(--danger)' }}>
                                        {healthScore.toFixed(0)}
                                    </div>
                                </div>
                                <div className="health-recommendations">
                                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '14px' }}>AI Insights:</h4>
                                    {recs.map((rec, i) => (
                                        <div key={i} className="rec-item">
                                            <Target size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                                            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{rec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="charts-row">
                            <div className="chart-card">
                                <h3>Allocation by Category</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="chart-card">
                                <h3>P&L per Asset ($)</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={barData}>
                                        <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#666" fontSize={12} tickFormatter={(val) => `$${val}`} width={60} tickLine={false} axisLine={false} />
                                        <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                                        <ReferenceLine y={0} stroke="#333" />
                                        <Bar dataKey="PnL" radius={[4, 4, 0, 0]}>
                                            {barData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.PnL >= 0 ? '#10b981' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="table-section">
                            <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Your Assets</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Asset</th>
                                            <th>Category</th>
                                            <th>Qty</th>
                                            <th>Avg Buy</th>
                                            <th>Current Price</th>
                                            <th>Total Val</th>
                                            <th>P&L $</th>
                                            <th>P&L %</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enrichedAssets.length === 0 ? (
                                            <tr><td colSpan="9" style={{ textAlign: 'center', opacity: 0.5 }}>No assets found</td></tr>
                                        ) : enrichedAssets.map(t => (
                                            <tr key={t.id}>
                                                <td style={{ fontWeight: '600' }}>{t.ticker}</td>
                                                <td><span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px' }}>{t.category}</span></td>
                                                <td>{t.quantity}</td>
                                                <td>{formatCurrency(t.avg_buy_price)}</td>
                                                <td>{t.currentPrice === undefined ? <span className={isLoading ? "skeleton" : ""} style={{color: '#666'}}>--</span> : formatCurrency(t.currentPrice)}</td>
                                                <td>{formatCurrency(t.value)}</td>
                                                <td className={t.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{t.pnl > 0 ? '+' : ''}{formatCurrency(t.pnl)}</td>
                                                <td className={t.pnlPerc >= 0 ? 'pnl-positive' : 'pnl-negative'}>{t.pnlPerc > 0 ? '+' : ''}{t.pnlPerc.toFixed(2)}%</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => openModal(t)}><Edit2 size={16} /></button>
                                                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => {setItemToDelete(t.id)}}><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingAsset ? 'Edit' : 'Add'} Asset`}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ticker *</label>
                            <input type="text" className="select-filter" style={{ width: '100%' }} placeholder="AAPL, BTC..." required value={formData.ticker} onChange={e => setFormData({ ...formData, ticker: e.target.value })} disabled={!!editingAsset} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Category *</label>
                            <select className="select-filter" style={{ width: '100%' }} required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option value="Stock">Stock</option>
                                <option value="Crypto">Crypto</option>
                                <option value="ETF">ETF</option>
                                <option value="Bono">Bono</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Quantity *</label>
                            <input type="number" step="any" className="select-filter" style={{ width: '100%' }} required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Avg Buy Price ($) *</label>
                            <input type="number" step="any" className="select-filter" style={{ width: '100%' }} required value={formData.avg_buy_price} onChange={e => setFormData({ ...formData, avg_buy_price: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Buy Date *</label>
                        <input type="date" className="select-filter" style={{ width: '100%' }} required value={formData.buy_date} onChange={e => setFormData({ ...formData, buy_date: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Notes</label>
                        <input type="text" className="select-filter" style={{ width: '100%' }} placeholder="Long term hold..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm" style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '6px' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{ borderRadius: '6px' }}>Save Asset</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirm Delete">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Are you sure you want to delete this asset from your portfolio?</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm" style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '6px' }} onClick={() => setItemToDelete(null)}>Cancel</button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={confirmDelete}>Delete</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
