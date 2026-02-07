import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Lock, Mail, UserCircle2 } from 'lucide-react';
import { usersApi } from '../../services/usersApi';
import type { UserAccount } from '../../types';
import { useToast } from '../../hooks/useToast';

const EMAIL_REGEX = /.+@.+\..+/i;
const MIN_PASSWORD_LENGTH = 8;
const MAX_FILE_SIZE = 500 * 1024; // 500KB

const compressImage = (
  file: File,
  callback: (compressed: string) => void,
  maxSize: number = MAX_FILE_SIZE
): void => {
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Redimensionar se necessário
      const maxDimension = 800;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      // Ajustar qualidade até ficar dentro do limite
      let quality = 0.9;
      let compressed = canvas.toDataURL('image/jpeg', quality);

      while (compressed.length > maxSize && quality > 0.1) {
        quality -= 0.1;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }

      if (compressed.length > maxSize) {
        throw new Error('Nao foi possivel comprimir a imagem o suficiente.');
      }

      callback(compressed);
    };
    img.src = e.target?.result as string;
  };

  reader.readAsDataURL(file);
};

export const SettingsAccountTab: React.FC = () => {
  const toast = useToast();
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    profileImage: '' as string | null,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const me = await usersApi.me();
        if (!mounted) return;
        setAccount(me);
        setProfileForm({
          name: me.name ?? '',
          email: me.email ?? '',
          profileImage: me.profileImage ?? null,
        });
      } catch (error) {
        console.error('Erro ao carregar usuario:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    if (!account?.name) return 'U';
    return account.name
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [account?.name]);

  const handleAvatarChange = (file?: File | null) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE * 2) {
      toast.error('Arquivo muito grande. Selecione uma imagem menor que 1MB.');
      return;
    }

    try {
      compressImage(file, (compressed) => {
        setProfileForm((prev) => ({ ...prev, profileImage: compressed }));
        toast.info('Imagem comprimida e pronta para salvar.');
      });
    } catch (error) {
      toast.error('Erro ao processar a imagem. Tente outra.');
    }
  };

  const handleProfileSubmit = async () => {
    if (!profileForm.name.trim()) {
      toast.error('Informe um nome valido.');
      return;
    }

    if (!EMAIL_REGEX.test(profileForm.email)) {
      toast.error('Informe um email valido.');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await usersApi.updateMe({
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        profileImage: profileForm.profileImage || null,
      });
      setAccount(updated);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error(error.message || 'Nao foi possivel atualizar o perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordForm.currentPassword) {
      toast.error('Informe sua senha atual.');
      return;
    }

    if (passwordForm.newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`A nova senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('A confirmacao de senha nao confere.');
      return;
    }

    setSavingPassword(true);
    try {
      await usersApi.updateMePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      toast.error('Nao foi possivel atualizar a senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        Carregando conta...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <UserCircle2 size={24} />
          </div>
          <div>
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">Dados da Conta</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Atualize suas informacoes pessoais</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          <div className="relative w-28 h-28 rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center text-xl font-black text-slate-500">
            {profileForm.profileImage ? (
              <img src={profileForm.profileImage} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
            <label className="absolute bottom-2 right-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full p-2 cursor-pointer shadow-sm">
              <Camera size={14} className="text-slate-600 dark:text-slate-300" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleAvatarChange(event.target.files?.[0])}
              />
            </label>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Nome</label>
              <input
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
                value={profileForm.name}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleProfileSubmit}
            disabled={savingProfile}
            className="px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingProfile ? 'Salvando...' : 'Salvar Alteracoes'}
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">Seguranca</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Atualize sua senha</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Senha atual</label>
            <input
              type="password"
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Nova senha</label>
            <input
              type="password"
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest ml-1">Confirmar nova senha</label>
            <input
              type="password"
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handlePasswordSubmit}
            disabled={savingPassword}
            className="px-6 py-3 bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingPassword ? 'Atualizando...' : 'Atualizar Senha'}
          </button>
        </div>
      </section>
    </div>
  );
};
