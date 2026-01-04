import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Download, 
  Smartphone, 
  Share, 
  Plus,
  Check,
  Tv,
  Wifi,
  Zap,
  ChevronRight
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const features = [
    {
      icon: Tv,
      title: 'TV ao Vivo',
      description: 'Assista canais ao vivo direto no seu celular'
    },
    {
      icon: Wifi,
      title: 'Funciona Offline',
      description: 'Navegue pelo app mesmo sem internet'
    },
    {
      icon: Zap,
      title: 'Carregamento Rápido',
      description: 'Performance otimizada para mobile'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-20 pb-24 px-4 safe-area-padding">
        <div className="max-w-lg mx-auto">
          {/* Hero Section */}
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Tv className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl mb-3">
              Instale o NETIPFLIX
            </h1>
            <p className="text-muted-foreground text-lg">
              Tenha acesso rápido ao seu streaming favorito
            </p>
          </div>

          {/* Install Status Card */}
          {isInstalled ? (
            <Card className="mb-8 border-green-500/30 bg-green-500/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-500">App Instalado!</p>
                    <p className="text-sm text-muted-foreground">
                      O NETIPFLIX está na sua tela inicial
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Instalar App
                </CardTitle>
                <CardDescription>
                  Adicione o NETIPFLIX à sua tela inicial para acesso rápido
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall} 
                    className="w-full h-12 text-lg"
                    size="lg"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Instalar Agora
                  </Button>
                ) : isIOS ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Para instalar no iPhone/iPad:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                        <div className="flex-1">
                          <p className="text-sm">Toque em <Share className="h-4 w-4 inline mx-1" /> Compartilhar</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                        <div className="flex-1">
                          <p className="text-sm">Role e toque em <Plus className="h-4 w-4 inline mx-1" /> "Adicionar à Tela de Início"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                        <div className="flex-1">
                          <p className="text-sm">Toque em "Adicionar"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isAndroid ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Para instalar no Android:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                        <div className="flex-1">
                          <p className="text-sm">Toque no menu do navegador (⋮)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                        <div className="flex-1">
                          <p className="text-sm">Toque em "Adicionar à tela inicial" ou "Instalar app"</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                        <div className="flex-1">
                          <p className="text-sm">Confirme a instalação</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Abra este link no seu celular para instalar o app
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Features */}
          <div className="space-y-4">
            <h2 className="font-display text-xl mb-4">Por que instalar?</h2>
            {features.map((feature, index) => (
              <Card key={index} className="bg-secondary/30 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{feature.title}</p>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Install;
