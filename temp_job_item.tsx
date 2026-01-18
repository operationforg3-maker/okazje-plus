
/* ==================== UI COMPONENTS ==================== */

function JobItem({ job }: { job: HarvesterJob }) {
  const [expanded, setExpanded] = useState(false);
  
  const isTreeMode = (job.totalCategories || 0) > 0;
  // Fallback for progress percent
  const progressPercent = isTreeMode
    ? Math.round(((job.processedCategories?.length || 0) / (job.totalCategories || 1)) * 100)
    : (job.progress || 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      case "paused": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const durationStr = (() => {
     const end = new Date(job.completedAt || new Date()).getTime();
     const start = new Date(job.startedAt).getTime();
     return `${Math.round((end - start) / 1000)}s`;
  })();

  return (
    <div className="p-4 border rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm mb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {/* Header Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={getStatusColor(job.status)}>
              {job.status === 'running' && <Zap className="w-3 h-3 mr-1 animate-spin" />}
              {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {job.status}
            </Badge>
            <span className="font-mono text-sm text-slate-600">
              {job.id.slice(0, 8)}...
            </span>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(job.startedAt).toLocaleString("pl-PL")}
            </span>
             {isTreeMode && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                  <ListTree className="w-3 h-3 mr-1" />
                  Tree Mode
                </Badge>
             )}
          </div>

          {/* Job Info */}
          <div className="text-sm">
             <span className="font-semibold text-slate-700">{job.source}</span>
             <ArrowRight className="inline mx-1 w-3 h-3 text-slate-400" />
             <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">"{job.query}"</span>
          </div>

          {/* Progress Section */}
          <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-100">
            {isTreeMode ? (
               <div className="flex justify-between text-xs font-medium text-slate-600">
                 <span>Kategorie: {job.processedCategories?.length || 0} / {job.totalCategories}</span>
                 <span>{progressPercent}%</span>
               </div>
            ) : (
                <div className="flex justify-between text-xs font-medium text-slate-600">
                     <span>Postęp ogólny</span>
                    <span>{progressPercent}%</span>
                </div>
            )}
            
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${job.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(2, Math.min(100, progressPercent))}%` }}
              />
            </div>
            
            {job.status === 'running' && isTreeMode && job.currentCategory && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100 animate-pulse">
                  <Zap className="w-3 h-3" />
                  <span className="font-semibold">Przetwarzanie:</span>
                  <span className="font-mono truncate flex-1">{job.currentCategory}</span>
                </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <MetricBox label="Znaleziono" value={job.productsFound} />
            <MetricBox label="Produkty (+)" value={job.productsCreated} color="text-green-600" />
            <MetricBox label="Deale (+)" value={job.dealsCreated} color="text-blue-600" />
            <MetricBox label="Czas" value={durationStr} />
          </div>
          
          {/* Detailed Categories Collapsible */}
          {isTreeMode && (job.processedCategories?.length || 0) > 0 && (
            <div className="mt-2 text-xs">
              <button 
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors font-medium ml-1"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Zwiń historię kategorii" : `Pokaż historię (${job.processedCategories?.length})`}
              </button>
              
              {expanded && job.processedCategories && (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded bg-white divide-y divide-slate-100 shadow-inner">
                  {[...job.processedCategories].reverse().map((cat, idx) => (
                    <div key={idx} className="flex justify-between items-center px-3 py-1.5">
                       <span className="truncate flex-1 pr-2 text-slate-600" title={cat.category}>{cat.category}</span>
                       <div className="flex items-center gap-2 shrink-0">
                         <span className="font-mono">{cat.count} szt.</span>
                         {cat.status === 'ok' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-4">
                  Szczegóły
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Job {job.id}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Status</p>
                    <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Source</p>
                    <p className="font-mono">{job.source}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Query</p>
                    <p className="font-mono text-xs">{job.query}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-slate-900">Wyniki</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Produktów znalezionych</p>
                      <p className="text-lg font-semibold">{job.productsFound}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Nowych produktów</p>
                      <p className="text-lg font-semibold text-green-600">{job.productsCreated}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Nowych Deali</p>
                      <p className="text-lg font-semibold text-blue-600">{job.dealsCreated}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Duplikatów pominięto</p>
                      <p className="text-lg font-semibold text-amber-600">{job.duplicatesSkipped}</p>
                    </div>
                  </div>
                </div>

                {job.processedCategories && job.processedCategories.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                    <h4 className="font-semibold text-slate-900 sticky top-0 bg-slate-50 pb-2 border-b text-sm">
                      Szczegóły Kategorii ({job.processedCategories.length})
                    </h4>
                    <div className="space-y-1 text-xs">
                      {job.processedCategories.map((cat, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-slate-200 last:border-0">
                          <span className="font-mono text-slate-700 truncate flex-1 pr-2" title={cat.category}>{cat.category}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold">{cat.count}</span>
                            {cat.status === 'ok' ? (
                              <span className="text-green-600">OK</span>
                            ) : (
                              <span className="text-red-600">ERR</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = "text-slate-900" }: { label: string, value: any, color?: string }) {
  return (
    <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p className={`font-bold ${color}`}>{value}</p>
    </div>
  );
}
