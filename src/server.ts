/**
 * Cart Service - Bootstrap Entry Point
 * Loads environment and starts the application
 */
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

async function main() {
  try {
    console.log('Starting cart-service...');

    // Import and start the application
    const { startServer } = await import('./app.js');
    await startServer();
  } catch (error) {
    console.error('Failed to start cart-service:', error);
    process.exit(1);
  }
}

main();
