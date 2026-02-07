import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  MessageSquare,
} from "lucide-react";

interface Annotation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  type: "feedback" | "deduction";
  points?: number;
}

interface PDFViewerProps {
  file: File | null;
  annotations?: Annotation[];
  onAnnotationAdd?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (index: number, annotation: Annotation) => void;
  onAnnotationDelete?: (index: number) => void;
  readOnly?: boolean;
}

const PDFViewer = ({ 
  file, 
  annotations = [], 
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  readOnly = false 
}: PDFViewerProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    if (pdfUrl && canvasRef.current) {
      renderPDF();
    }
  }, [pdfUrl, currentPage, scale]);

  const renderPDF = async () => {
    if (!pdfUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const pdf = await (window as any).pdfjsLib.getDocument(pdfUrl).promise;
      setNumPages(pdf.numPages);
      
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;
    } catch (error) {
      console.error("Error rendering PDF:", error);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / scale);
    const y = ((event.clientY - rect.top) / scale);

    const newAnnotation: Annotation = {
      page: currentPage,
      x,
      y,
      width: 200,
      height: 100,
      text: "",
      type: "feedback",
    };

    onAnnotationAdd?.(newAnnotation);
  };

  const getPageAnnotations = () => {
    return annotations.filter(ann => ann.page === currentPage);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, numPages));

  const downloadPDF = () => {
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevPage} disabled={currentPage <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[80px] text-center">
              Page {currentPage} of {numPages || 0}
            </span>
            <Button variant="outline" size="sm" onClick={nextPage} disabled={currentPage >= numPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPDF}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PDF Canvas */}
        <Card className="p-4">
          <div className="border rounded-lg overflow-auto max-h-[600px] bg-gray-50">
            {pdfUrl ? (
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="cursor-crosshair"
                style={{ maxWidth: "100%" }}
              />
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Upload a PDF to preview
              </div>
            )}
          </div>
        </Card>

        {/* Annotations Panel */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4" />
            <h3 className="font-medium">Annotations</h3>
            <Badge variant="secondary">
              {getPageAnnotations().length} on this page
            </Badge>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {getPageAnnotations().length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {readOnly ? "No annotations on this page" : "Click on the PDF to add annotations"}
              </p>
            ) : (
              getPageAnnotations().map((annotation, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedAnnotation === index ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedAnnotation(index)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={annotation.type === "deduction" ? "destructive" : "secondary"}>
                        {annotation.type === "deduction" ? "Deduction" : "Feedback"}
                      </Badge>
                      {annotation.points !== undefined && (
                        <span className="text-sm font-medium">
                          -{annotation.points} pts
                        </span>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAnnotationDelete?.(index)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  
                  {selectedAnnotation === index ? (
                    <div className="space-y-2">
                      <Label>Annotation</Label>
                      <Textarea
                        value={annotation.text}
                        onChange={(e) => onAnnotationUpdate?.(index, {
                          ...annotation,
                          text: e.target.value,
                        })}
                        rows={3}
                        placeholder="Add your feedback or deduction reason..."
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {annotation.text || "Click to edit annotation..."}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {!readOnly && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAnnotationAdd?.({
                    page: currentPage,
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 100,
                    text: "",
                    type: "feedback",
                  })}
                >
                  Add Feedback
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAnnotationAdd?.({
                    page: currentPage,
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 100,
                    text: "",
                    type: "deduction",
                    points: 5,
                  })}
                >
                  Add Deduction
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PDFViewer;
