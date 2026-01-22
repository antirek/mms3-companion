import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mms3_ask_bot';

let isConnected = false;

/**
 * Подключение к MongoDB
 * @returns {Promise<void>}
 */
export async function connectDatabase() {
  if (isConnected) {
    console.log('MongoDB уже подключена');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('MongoDB подключена:', MONGODB_URI);
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error);
    throw error;
  }
}

/**
 * Отключение от MongoDB
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB отключена');
  } catch (error) {
    console.error('Ошибка отключения от MongoDB:', error);
    throw error;
  }
}

// Обработка событий подключения
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  isConnected = false;
});
