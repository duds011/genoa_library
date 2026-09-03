export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="k-join">
      <div className="k-join-glow" aria-hidden />
      {children}
    </div>
  )
}
