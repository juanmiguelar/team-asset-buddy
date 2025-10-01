import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, QrCode, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const Scanner = () => {
  const navigate = useNavigate();
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    // Check if camera is available
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then(() => setHasCamera(true))
      .catch(() => setHasCamera(false));
  }, []);

  const handleManualInput = () => {
    const code = prompt("Ingresa el código QR manualmente:");
    if (code) {
      handleQRCode(code);
    }
  };

  const handleQRCode = (code: string) => {
    // Parse QR code format: asset:{id} or license:{id}
    const parts = code.split(":");
    if (parts.length !== 2) {
      toast.error("Código QR inválido");
      return;
    }

    const [type, id] = parts;
    if (type === "asset") {
      navigate(`/asset/${id}`);
    } else if (type === "license") {
      navigate(`/license/${id}`);
    } else {
      toast.error("Tipo de código QR no reconocido");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto shadow-elevated">
          <CardHeader className="text-center">
            <div className="w-20 h-20 rounded-2xl gradient-secondary flex items-center justify-center mx-auto mb-4 shadow-soft">
              <QrCode className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl">Escanear Código QR</CardTitle>
            <CardDescription>
              Apunta la cámara al código QR del activo o licencia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasCamera ? (
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 animate-pulse" />
                <div className="relative z-10 text-center">
                  <Camera className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Función de cámara en desarrollo
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center p-6">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
                  <p className="text-sm text-muted-foreground">
                    No se puede acceder a la cámara
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button
                variant="hero"
                className="w-full"
                onClick={handleManualInput}
              >
                <QrCode className="w-5 h-5" />
                Ingresar código manualmente
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                El formato del código es: asset:ID o license:ID
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Scanner;
