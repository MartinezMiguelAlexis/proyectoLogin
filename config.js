module.exports = {
    database: {
        host: '34.55.91.47',
        user: 'Conexion',
        password: 'Conexion123',
        database: 'proyecto2'
    },
    auth: {
        secret: 'mi_clave_secreta'
    },
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_51RRGMvCuovGCop2noyQWJ5X8JizFBm5JPUoZxBSBZmKehXrhl2R6CSdb9QjPMat39IDXBCXq5taYbHLEvEWR7Gta00RZgJbihc', // Reemplazar con tu clave real
        publicKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_51RRGMvCuovGCop2nV6SW0c1CabI6ZW8wWdwsBzyKkR0n6ExWHauh0GQdqwemG9ALS92fqYAEs07n22Sw9wVsQdjW00cWMoEMuw', // Reemplazar con tu clave real
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_90c2f25a97f942bdd1697350438a6923a2bdf889aaa72ad200458bf1c69a2b71'  // El secret que te dio la CLI
    },
    frontendUrl: 'http://localhost:3000' // Cambia esto en producción
};