'use client';

import { auth } from '@/firebase';

export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Bạn cần đăng nhập tài khoản admin trước khi dùng công cụ này.');
  }

  const idToken = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
  };
}
