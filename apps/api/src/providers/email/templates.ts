import type { EmailMessage } from './email.provider.js';

export type MailLocale = 'vi' | 'en' | 'ja';

type TemplateKind = 'verifyEmail' | 'resetPassword' | 'setPassword' | 'invitation';

interface Copy {
  subject: string;
  intro: string;
  action: string;
  outro: string;
}

const COPY: Record<MailLocale, Record<TemplateKind, Copy>> = {
  vi: {
    verifyEmail: {
      subject: 'Xác minh email của bạn',
      intro: 'Chào mừng bạn đến với Interpreter AI. Vui lòng xác minh email:',
      action: 'Liên kết có hiệu lực trong 24 giờ.',
      outro: 'Nếu bạn không đăng ký, hãy bỏ qua email này.',
    },
    resetPassword: {
      subject: 'Đặt lại mật khẩu',
      intro: 'Bạn đã yêu cầu đặt lại mật khẩu. Mở liên kết sau:',
      action: 'Liên kết có hiệu lực trong 1 giờ.',
      outro: 'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    },
    setPassword: {
      subject: 'Thiết lập mật khẩu tài khoản',
      intro: 'Một tài khoản đã được tạo cho bạn. Đặt mật khẩu tại:',
      action: 'Liên kết có hiệu lực trong 7 ngày.',
      outro: 'Nếu bạn không mong đợi email này, hãy bỏ qua.',
    },
    invitation: {
      subject: 'Lời mời tham gia tổ chức',
      intro: 'Bạn được mời tham gia một tổ chức trên Interpreter AI:',
      action: 'Lời mời có hiệu lực trong 7 ngày.',
      outro: 'Nếu bạn không mong đợi email này, hãy bỏ qua.',
    },
  },
  en: {
    verifyEmail: {
      subject: 'Verify your email',
      intro: 'Welcome to Interpreter AI. Please verify your email:',
      action: 'This link is valid for 24 hours.',
      outro: 'If you did not sign up, ignore this email.',
    },
    resetPassword: {
      subject: 'Reset your password',
      intro: 'You requested a password reset. Open this link:',
      action: 'This link is valid for 1 hour.',
      outro: 'If you did not request it, ignore this email.',
    },
    setPassword: {
      subject: 'Set your account password',
      intro: 'An account was created for you. Set your password here:',
      action: 'This link is valid for 7 days.',
      outro: 'If you did not expect this email, ignore it.',
    },
    invitation: {
      subject: 'You are invited to join an organization',
      intro: 'You have been invited to an organization on Interpreter AI:',
      action: 'This invitation is valid for 7 days.',
      outro: 'If you did not expect this email, ignore it.',
    },
  },
  ja: {
    verifyEmail: {
      subject: 'メールアドレスの確認',
      intro: 'Interpreter AI へようこそ。次のリンクでメールアドレスを確認してください:',
      action: 'リンクの有効期限は24時間です。',
      outro: '心当たりがない場合は、このメールを無視してください。',
    },
    resetPassword: {
      subject: 'パスワードの再設定',
      intro: 'パスワード再設定のリクエストを受け付けました。次のリンクを開いてください:',
      action: 'リンクの有効期限は1時間です。',
      outro: '心当たりがない場合は、このメールを無視してください。',
    },
    setPassword: {
      subject: 'アカウントのパスワード設定',
      intro: 'アカウントが作成されました。次のリンクでパスワードを設定してください:',
      action: 'リンクの有効期限は7日間です。',
      outro: '心当たりがない場合は、このメールを無視してください。',
    },
    invitation: {
      subject: '組織への招待',
      intro: 'Interpreter AI の組織に招待されました:',
      action: '招待の有効期限は7日間です。',
      outro: '心当たりがない場合は、このメールを無視してください。',
    },
  },
};

export function buildEmail(
  kind: TemplateKind,
  locale: MailLocale,
  to: string,
  link: string,
): EmailMessage {
  const copy = COPY[locale][kind];
  return {
    to,
    subject: copy.subject,
    text: `${copy.intro}\n\n${link}\n\n${copy.action}\n${copy.outro}\n`,
  };
}
