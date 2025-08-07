import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sql from './db.js';  // tu conexión postgres

const app = express();
const port = process.env.PORT || 3000;

// Habilitar CORS para todas las rutas (puedes restringir el origen si quieres)
app.use(cors());

// Middleware para parsear JSON
app.use(bodyParser.json());

app.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    // Busca el usuario en la DB
    const result = await sql`
      SELECT usuario, contrasena, rol
      FROM usuarios
      WHERE usuario = ${usuario}
      LIMIT 1
    `;

    if (result.count === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = result[0];

    // Compara contraseñas (texto plano por ahora)
    if (user.contrasena !== contrasena) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Login exitoso
    res.json({
      message: 'Login correcto',
      usuario: user.usuario,
      rol: user.rol,
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(port, () => {
  console.log(`Backend corriendo en http://localhost:${port}`);
});
