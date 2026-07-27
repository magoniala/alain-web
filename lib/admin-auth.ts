export function requireAdminAuth(req: Request): boolean {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}
