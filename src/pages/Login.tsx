import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Tv } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TVCodeLogin } from '@/components/TVCodeLogin';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showTVCode, setShowTVCode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user } = useAuth();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          toast.error('Por favor, insira seu nome');
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(email, password, name);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este email já está cadastrado');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Conta criada com sucesso!');
          navigate(from, { replace: true });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email ou senha incorretos');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Login realizado com sucesso!');
          navigate(from, { replace: true });
        }
      }
    } catch (error) {
      toast.error('Ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1920&h=1080&fit=crop')`,
        }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>

      {/* Logo */}
      <div className="absolute top-8 left-8 z-10">
        <h1 className="font-display text-3xl md:text-4xl text-primary tracking-widest">
          NETIPFLIX
        </h1>
      </div>

      {/* Login Form */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/90 backdrop-blur-xl rounded-lg p-8 md:p-12 shadow-2xl border border-border/50">
          <h2 className="font-display text-3xl md:text-4xl mb-8 tracking-wide">
            {showTVCode ? 'Login na TV' : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </h2>

          {showTVCode ? (
            <>
              <TVCodeLogin />
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowTVCode(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Voltar para login normal
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="h-12 pl-10 bg-secondary/50 border-border/50 focus:border-primary"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-12 pl-10 bg-secondary/50 border-border/50 focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="xl"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                isSignUp ? 'Criar Conta' : 'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isSignUp ? 'Já tem uma conta?' : 'Novo por aqui?'}{' '}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-foreground hover:text-primary transition-colors font-medium"
              >
                {isSignUp ? 'Entrar' : 'Criar conta'}
              </button>
            </p>
          </div>

          {!isSignUp && (
            <>
              <div className="mt-4 text-center">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Esqueceu a senha?
                </button>
              </div>

              {/* TV Login Button */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowTVCode(true)}
                >
                  <Tv className="h-5 w-5 mr-2" />
                  Entrar na TV
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Gera um código para digitar no celular
                </p>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => navigate('/code')}
                >
                  Tenho um código
                </Button>
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
