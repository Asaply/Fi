"use client";
import { useState, useEffect } from "react";
import { User, Activity, Settings, TrendingUp, BarChart2, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import "./Portfolio.css";

export default function PortfolioHealth() {
    const [assets, setAssets] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [healthData, setHealthData] = useState(null);

    // Fetch unique assets from trading_operations
    useEffect(() => {
        const fetchAssets = async () => {
            const { data, error } = await supabase
                .from('trading_operations')
                .select('asset')
                .eq('status', 'Abierto');
            
            if (data && !error) {
                const uniqueAssets = [...new Set(data.map(t => t.asset))];
                setAssets(uniqueAssets);
            }
        };
        fetchAssets();
    }, []);

    // Mock API call to get real-time health check
    const runHealthCheck = () => {
        setIsAnalyzing(true);
        
        setTimeout(() => {
            // Evaluamos activos. Si no hay, inventamos una cartera genérica.
            const targetAssets = assets.length > 0 ? assets : ['AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'NVDA', 'META', 'NFLX'];
            
            let breakdowns = {
                strongBuy: 0,
                buy: 0,
                neutral: 0,
                sell: 0,
                strongSell: 0,
                notCovered: 0
            };

            let totalScore = 0;

            targetAssets.forEach(() => {
                const rand = Math.random();
                if (rand < 0.3) { breakdowns.strongBuy++; totalScore += 5; }
                else if (rand < 0.5) { breakdowns.buy++; totalScore += 4; }
                else if (rand < 0.8) { breakdowns.neutral++; totalScore += 3; }
                else if (rand < 0.9) { breakdowns.sell++; totalScore += 2; }
                else if (rand < 0.95) { breakdowns.strongSell++; totalScore += 1; }
                else { breakdowns.notCovered++; }
            });

            const coveredCount = targetAssets.length - breakdowns.notCovered;
            const avgScore = coveredCount > 0 ? (totalScore / coveredCount).toFixed(2) : 0;

            setHealthData({
                score: parseFloat(avgScore),
                breakdowns
            });
            
            setHasAnalyzed(true);
            setIsAnalyzing(false);
        }, 1500);
    };

    const getScoreAngle = (score) => {
        const percentage = score / 5;
        // From 0 to 180 degrees
        return percentage * 180;
    };

    return (
        <div className="portfolio-container">
            {/* Sidebar de navegación tipo Wizard */}
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
                    <div className="p-nav-item">
                        <div className="p-nav-icon"><TrendingUp size={14} /></div>
                        <div className="p-nav-text">
                            <span className="p-nav-title">Follow Stocks</span>
                            <span className="p-nav-desc">Get unlimited breaking news</span>
                        </div>
                    </div>
                    <div className="p-nav-item">
                        <div className="p-nav-icon"><Settings size={14} /></div>
                        <div className="p-nav-text">
                            <span className="p-nav-title">Optimize Portfolio</span>
                            <span className="p-nav-desc">Track stocks smarter</span>
                        </div>
                    </div>
                    <div className="p-nav-item active">
                        <div className="p-nav-icon" style={{ borderRadius: '50%', padding: '4px' }}>
                            <Check size={14} strokeWidth={3} />
                        </div>
                        <div className="p-nav-text">
                            <span className="p-nav-title">Portfolio Health Check</span>
                            <span className="p-nav-desc">Spot strengths and risks</span>
                        </div>
                    </div>
                    <div className="p-nav-item">
                        <div className="p-nav-icon" style={{ background: 'transparent' }}><Activity size={14} /></div>
                        <div className="p-nav-text">
                            <span className="p-nav-title">Read AI Report</span>
                            <span className="p-nav-desc">Access fast, powerful research</span>
                        </div>
                    </div>
                    <div className="p-nav-item">
                        <div className="p-nav-icon" style={{ background: 'transparent' }}><BarChart2 size={14} /></div>
                        <div className="p-nav-text">
                            <span className="p-nav-title">Compare Your Stocks</span>
                            <span className="p-nav-desc">Uncover side-by-side insights</span>
                        </div>
                    </div>
                </div>

                <div className="p-steps">
                    2/5 steps completed
                </div>
            </aside>

            {/* Contenido Principal */}
            <main className="portfolio-content">
                <h1 className="p-title">Check Your Portfolio's Health</h1>
                <p className="p-description">
                    Run a free health check to uncover potential strengths and weaknesses in your portfolio, and get timely insights to help you act strategically.
                </p>

                <button 
                    className="btn-dark" 
                    onClick={runHealthCheck}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? "Analyzing..." : "Run Health Check"}
                </button>

                {hasAnalyzed && healthData && (
                    <div className="portfolio-card">
                        <div className="card-header-flex">
                            <div className="card-title">
                                My Portfolio <ChevronDown size={20} />
                            </div>
                            <div className="card-subtitle">
                                Today's Gain: <span style={{ color: "var(--success)", fontWeight: "600" }}>2.44%</span>
                            </div>
                        </div>

                        <div className="section-label">HOW HEALTHY IS YOUR PORTFOLIO</div>

                        <div className="health-grid">
                            <div className="gauge-section">
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '32px' }}>Score</div>
                                
                                <div className="gauge-container">
                                    <svg viewBox="0 0 200 110" style={{ width: '100%', overflow: 'visible' }}>
                                        {/* Background Arcs */}
                                        <path d="M 20 100 A 80 80 0 0 1 70 30" fill="none" stroke="#b91c1c" strokeWidth="20" />
                                        <path d="M 70 30 A 80 80 0 0 1 130 30" fill="none" stroke="#facc15" strokeWidth="20" />
                                        <path d="M 130 30 A 80 80 0 0 1 180 100" fill="none" stroke="#15803d" strokeWidth="20" />
                                        
                                        {/* Needle */}
                                        <line 
                                            x1="100" y1="100" 
                                            x2="30" y2="100" 
                                            stroke="#18181b" 
                                            strokeWidth="4" 
                                            strokeLinecap="round"
                                            transform={`rotate(${getScoreAngle(healthData.score)}, 100, 100)`}
                                            style={{ transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
                                        />
                                        <circle cx="100" cy="100" r="6" fill="#18181b" />
                                    </svg>
                                    
                                    <div className="gauge-center-label">
                                        {healthData.score.toFixed(2)}
                                    </div>

                                    <div className="gauge-score-info">
                                        Your rating<br/>score is<br/>
                                        <span className="gauge-score-value">{healthData.score.toFixed(2)}</span> / 5.00
                                    </div>
                                </div>
                            </div>

                            <div className="breakdown-section">
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Breakdown</div>
                                <div className="breakdown-list">
                                    <div className="breakdown-row">
                                        <div className="row-label"><span className="dot" style={{background: '#15803d'}}></span> Strong Buy:</div>
                                        <div className="row-dots"></div>
                                        <div className="row-value">{healthData.breakdowns.strongBuy} <span style={{fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>stocks</span> <ChevronDown size={14} color="#a1a1aa" /></div>
                                    </div>
                                    <div className="breakdown-row">
                                        <div className="row-label"><span className="dot" style={{background: '#22c55e'}}></span> Buy:</div>
                                        <div className="row-dots"></div>
                                        <div className="row-value">{healthData.breakdowns.buy} <span style={{fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>stock</span> <ChevronDown size={14} color="#a1a1aa" /></div>
                                    </div>
                                    <div className="breakdown-row">
                                        <div className="row-label"><span className="dot" style={{background: '#facc15'}}></span> Neutral:</div>
                                        <div className="row-dots"></div>
                                        <div className="row-value">{healthData.breakdowns.neutral} <span style={{fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>stocks</span> <ChevronDown size={14} color="#a1a1aa" /></div>
                                    </div>
                                    <div className="breakdown-row">
                                        <div className="row-label"><span className="dot" style={{background: '#ef4444'}}></span> Sell:</div>
                                        <div className="row-dots"></div>
                                        <div className="row-value">{healthData.breakdowns.sell} <span style={{fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>stocks</span> <ChevronDown size={14} color="#a1a1aa" /></div>
                                    </div>
                                    <div className="breakdown-row">
                                        <div className="row-label"><span className="dot" style={{background: '#b91c1c'}}></span> Strong Sell:</div>
                                        <div className="row-dots"></div>
                                        <div className="row-value" style={{color: '#a1a1aa'}}>{healthData.breakdowns.strongSell} <span style={{fontWeight: 400, fontSize: '12px'}}>stocks</span> <ChevronDown size={14} color="#e4e4e7" /></div>
                                    </div>
                                    <div className="breakdown-row">
                                        <div className="row-label"><span className="dot" style={{background: '#d4d4d8'}}></span> Not Covered:</div>
                                        <div className="row-dots"></div>
                                        <div className="row-value">{healthData.breakdowns.notCovered} <span style={{fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>stock</span> <ChevronDown size={14} color="#a1a1aa" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="section-label" style={{marginTop: '40px'}}>DIAGNOSIS</div>
                        <div className="diagnosis-box">
                            <Check className="diagnosis-check" size={20} /> 
                            Awesome! You have {healthData.breakdowns.strongBuy + healthData.breakdowns.buy} stocks rated highly.
                        </div>

                    </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: hasAnalyzed ? '40px' : '0' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px' }}>
                        Next <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                    </button>
                </div>
            </main>
        </div>
    );
}
