import { AlertCircle, ArrowUpRight, ArrowDownRight, Lightbulb, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function NvaIntelligencePanel({ intelligence }) {
  if (!intelligence) return null;

  const { metrics, recommendations, insights } = intelligence;

  // Render priority badge for recommendations
  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case "high":
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Urgente</span>;
      case "medium":
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">Aviso</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Sugerencia</span>;
    }
  };

  // Icon selector based on type
  const getIcon = (type, category) => {
    if (type === 'alert' || category === 'anomaly') return <AlertTriangle className="w-5 h-5 text-red-400" />;
    if (type === 'insight' || category === 'debt') return <TrendingUp className="w-5 h-5 text-indigo-400" />;
    return <Lightbulb className="w-5 h-5 text-orange-400" />;
  };

  return (
    <div className="flex flex-col gap-6 mt-6 p-1 border-t border-white/5 pt-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-6 h-6 text-orange-500" />
        <h3 className="text-xl font-medium tracking-tight text-white">Inteligencia Financiera NVA</h3>
      </div>
      
      {/* Metrics Section */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.savingsRate !== undefined ? (
            <>
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Tasa de Ahorro</p>
                <p className="text-2xl font-semibold text-white">{(metrics.savingsRate * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Flujo Neto</p>
                <p className={`text-2xl font-semibold ${metrics.netCashflow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.abs(metrics.netCashflow).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Uso de Crédito</p>
                <p className="text-2xl font-semibold text-white">{metrics.utilizationPercentage.toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Riesgo Intereses</p>
                <p className="text-2xl font-semibold text-red-400">${(metrics.interestExposure || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Recomendaciones</h4>
            <div className="flex flex-col gap-3">
              {recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
                  <div className="mt-0.5">{getIcon(rec.type)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-200">{rec.message}</p>
                    <div className="mt-2">{renderPriorityBadge(rec.priority)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {insights && insights.length > 0 && (
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Anomalías & Patrones</h4>
            <div className="flex flex-col gap-3">
              {insights.map((insight) => (
                <div key={insight.id} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
                  <div>{getIcon(null, insight.category)}</div>
                  <p className="text-sm text-gray-200 flex-1">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
