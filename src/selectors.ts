export const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  replyContext: '[data-testid="reply-context"]',
  caret: '[data-testid="caret"]',
  menu: '[role="menu"]',
  menuitem: '[role="menuitem"]',
  confirmSheet: '[data-testid="confirmationSheet"]',
  confirmDelete: '[data-testid="confirmationSheetConfirm"]',
  unretweetConfirm: '[data-testid="unretweetConfirm"]',
  loginButton: '[data-testid="loginButton"]',
  loginFormUsername: 'input[autocomplete="username"]',
} as const;

export const URL_PATTERNS = {
  loginFlow: "/i/flow/login",
  accountAccess: "/account/access",
} as const;

export function isLoggedOutUrl(url: string): boolean {
  return url.includes(URL_PATTERNS.loginFlow) || url.includes(URL_PATTERNS.accountAccess);
}
