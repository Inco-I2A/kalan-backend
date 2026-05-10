// server.js
// =========
// Point d'entrée du serveur KALAN

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log('========================================');
    console.log('  🎓 KALAN BACKEND');
    console.log('  📍 Burkina Faso — Offline First');
    console.log('  🔧 Version 1.1.0');
    console.log('========================================');
    console.log(`  🌐 Serveur: http://localhost:${PORT}`);
    console.log(`  📊 Health:  http://localhost:${PORT}/health`);
    console.log(`  📖 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`  🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  📅 Démarré: ${new Date().toLocaleString('fr-FR')}`);
    console.log('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM reçu, arrêt gracieux...');
    server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT reçu, arrêt gracieux...');
    server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
    });
});