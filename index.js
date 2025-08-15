import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sql from './db.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const port = process.env.PORT || 4000;

// Servidor HTTP para socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/proyecto2/api/socket.io',
  cors: {
    origin: ['http://localhost:4200', 'https://72.60.31.237' ],
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true
  }
});

app.use(cors({
  origin: 'https://72.60.31.237:4200',
  credentials: true
}));
app.use(bodyParser.json());

// ------------------- SOCKET.IO -------------------
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Recibir ubicación del delivery
  socket.on('updateLocation', async (data) => {
    try {
      const { userId, lat, lng } = data;

      // Guardar ubicación en la BD
      await sql`
        UPDATE usuarios
        SET ubicacion = ${`${lat},${lng}`}
        WHERE id = ${userId}
      `;

      console.log(`Ubicación actualizada para usuario ${userId}: ${lat}, ${lng}`);

      // Emitir la ubicación a todos los clientes (opcional)
      io.emit('locationUpdated', { userId, lat, lng });
    } catch (err) {
      console.error('Error guardando ubicación:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});
// ---------------------------------------------------

// LOGIN
app.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body;
  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const result = await sql`
      SELECT usuario, contrasena, rol
      FROM usuarios
      WHERE usuario = ${usuario}
      LIMIT 1
    `;
    if (result.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });
    const user = result[0];
    if (user.contrasena !== contrasena) return res.status(401).json({ error: 'Contraseña incorrecta' });

    res.json({ message: 'Login correcto', usuario: user.usuario, rol: user.rol });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /usuarios
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await sql`SELECT usuario, status, ubicacion FROM usuarios`;
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno al obtener usuarios' });
  }
});

// GET /deliveries
app.get('/deliveries', async (req, res) => {
  try {
    const deliveries = await sql`
      SELECT id, usuario as nombre,
             CASE WHEN status = 'activo' THEN 'working' ELSE 'off' END as status,
             ubicacion
      FROM usuarios
      WHERE rol = 'delivery'
    `;
    res.json(deliveries);
  } catch (error) {
    console.error('Error al obtener deliveries:', error);
    res.status(500).json({ error: 'Error interno al obtener deliveries' });
  }
});

// ENDPOINT PARA PAQUETES
app.post('/paquetes', async (req, res) => {
  try {
    const { nombre_repartidor, direccion } = req.body;
    if (!nombre_repartidor || !direccion) return res.status(400).json({ error: 'Nombre repartidor y ubicación son requeridos' });

    const [nuevoPaquete] = await sql`
      INSERT INTO paquetes (nombre_repartidor, direccion, status)
      VALUES (${nombre_repartidor}, ${direccion}, 'En tránsito')
      RETURNING id, nombre_repartidor, direccion, status
    `;
    res.status(201).json(nuevoPaquete);
  } catch (error) {
    console.error('Error al crear paquete:', error);
    res.status(500).json({ error: 'Error al crear paquete' });
  }
});

// GET /paquetes
app.get('/paquetes', async (req, res) => {
  try {
    const paquetes = await sql`
      SELECT id, nombre_repartidor, direccion, status
      FROM paquetes
      ORDER BY id ASC
    `;
    res.status(200).json(paquetes);
  } catch (error) {
    console.error('Error al obtener paquetes:', error);
    res.status(500).json({ error: 'Error al obtener paquetes' });
  }
});

// PATCH /paquetes/:id
app.patch('/paquetes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'El campo status es requerido' });

    const [paqueteActualizado] = await sql`
      UPDATE paquetes
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id, nombre_repartidor, direccion, status
    `;

    if (!paqueteActualizado) return res.status(404).json({ error: 'Paquete no encontrado' });
    res.status(200).json(paqueteActualizado);
  } catch (error) {
    console.error('Error actualizando paquete:', error);
    res.status(500).json({ error: 'Error al actualizar el paquete' });
  }
});

// PATCH /usuarios/:id/status
app.patch('/usuarios/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['activo', 'off'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });

  try {
    const result = await sql`
      UPDATE usuarios
      SET status = ${status}
      WHERE id = ${id}
      RETURNING id, usuario, status
    `;

    if (result.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Estado actualizado', usuario: result[0] });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ------------------- INICIAR SERVIDOR -------------------
httpServer.listen(port, () => {
  console.log(`Backend corriendo en https://72.60.31.237:${port}`);
});
