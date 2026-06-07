export default async function Layout({ children }: Readonly<{ params: Promise<{ id: string }>, children: React.ReactNode }>) {
    return <>{children}</>;
}
