const bodyParser = require('body-parser');
const fs = require('fs');

const express = require('express');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'storage/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

const upload = multer({ storage: storage });

//Conección a la base de datos de postgresql
const pgp = require('pg-promise')();
const db = pgp('postgres://fl0user:6xlCBe8qOZEs@ep-wandering-snow-a55ot4r0.us-east-2.aws.neon.fl0.io:5432/gym-db?sslmode=require');

const app = express();
const port = process.env.PORT ?? 3001;

app.use(bodyParser.json());

app.use(express.static('public'))
app.use('/storage', express.static(path.join(__dirname, 'storage')));


app.post('/nuevo_usuario', upload.single('photo'), (req, res) => {

    const {
        s_nombre,
        s_apellido_paterno,
        s_apellido_materno,
        s_telefono,
        d_fecha_nacimiento,
        d_fecha_inscripcion,
    } = req.body;

    const s_foto = req.file.filename || ''

    db.none(`
    SET TIMEZONE='America/Mexico_City';
    
    INSERT INTO cat_usuarios
    (
    s_nombre,
    s_apellido_paterno,
    s_apellido_materno,
    s_telefono,
    s_foto,
    d_fecha_nacimiento,
    d_fecha_inscripcion,
    d_fecha_creacion
    ) VALUES(
    $1,
    $2,
    $3,
    $4,
    $5,
    TO_DATE($6, \'DD/MM/YYYY\'),
    TO_DATE($7, \'DD/MM/YYYY\'),
    CURRENT_TIMESTAMP
    )`, [s_nombre, s_apellido_paterno, s_apellido_materno, s_telefono, s_foto, d_fecha_nacimiento, d_fecha_inscripcion])
        .then(() => {
            console.log('Usuario insertado correctamente')
            res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
        });
});

app.post('/editar_usuario', upload.single('photo'), (req, res) => {

    const {
        sk_usuario,
        s_nombre,
        s_apellido_paterno,
        s_apellido_materno,
        s_telefono,
        d_fecha_nacimiento,
        d_fecha_inscripcion,
    } = req.body;

    let s_foto = null;

    if (req.file) {
        s_foto = req.file.filename || ''
    }

    db.none(`
    UPDATE cat_usuarios SET
    s_nombre = '${s_nombre}',
    s_apellido_paterno = '${s_apellido_paterno}',
    s_apellido_materno = '${s_apellido_materno}',
    s_telefono = '${s_telefono}',
    s_foto = ${(s_foto) ? "'" + s_foto + "'" : 's_foto'},
    d_fecha_nacimiento = TO_DATE('${d_fecha_nacimiento}', \'DD/MM/YYYY\'),
    d_fecha_inscripcion = TO_DATE('${d_fecha_inscripcion}', \'DD/MM/YYYY\')
    WHERE sk_usuario = ${sk_usuario}`)
        .then(() => {
            console.log('Usuario insertado correctamente')
            res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
        });
});

app.get('/obtenerUsuarios', (req, res) => {
    db.any(`
    SELECT N1.*, DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) as dias_restantes FROM
    (
        SELECT sk_usuario,
        s_nombre,
        CONCAT(s_nombre, ' ', s_apellido_paterno, ' ', s_apellido_materno) AS s_nombre_completo,
        s_apellido_paterno,
        s_apellido_materno,
        s_telefono,
        s_foto,
        d_fecha_nacimiento,
        d_fecha_inscripcion,
        d_fecha_inscripcion + INTERVAL '1 month' as d_fecha_renovacion,
        d_fecha_creacion
        FROM cat_usuarios
    ) AS N1 `)
        .then((data) => {
            res.json(data)
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
        });
})

app.get('/obtenerUsuarios/:sk_usuario', (req, res) => {
    const sk_usuario = req.params.sk_usuario;
    const host = String(req.protocol + '://' + req.headers.host);

    db.one(`
    SELECT N1.*, DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) as dias_restantes FROM
    (
        SELECT sk_usuario,
        s_nombre,
        CONCAT(s_nombre, ' ', s_apellido_paterno, ' ', s_apellido_materno) AS s_nombre_completo,
        s_apellido_paterno,
        s_apellido_materno,
        s_telefono,
        s_foto,
        CONCAT('${host}', '/storage/', s_foto) url_foto,
        d_fecha_nacimiento,
        d_fecha_inscripcion,
        d_fecha_inscripcion + INTERVAL '1 month' as d_fecha_renovacion,
        d_fecha_creacion
        FROM cat_usuarios
    ) AS N1 WHERE N1.sk_usuario = ${sk_usuario}`)
        .then((data) => {
            res.json(data)
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
        });
})

app.post('/eliminarFoto', (req, res) => {
    const { sk_usuario } = req.body;

    db.one(`SELECT s_foto FROM cat_usuarios WHERE sk_usuario = ${sk_usuario}`)
        .then((data) => {
            const filePath = path.join(__dirname, 'storage', data.s_foto);
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error al eliminar el archivo:', err);
                    res.status(500).json({ message: 'Hubo un error al eliminar la foto', status: false });
                } else {
                    db.none(`UPDATE cat_usuarios SET s_foto = null WHERE sk_usuario = ${sk_usuario}`)
                        .then(() => {
                            res.status(200).json({ message: 'Foto eliminada con éxito', status: true });
                        })
                        .catch((error) => {
                            console.error('Error:', error);
                            res.status(500).json({ message: 'Hubo un error al actualizar la base de datos', status: false });
                        });
                }
            });

        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al obtener el nombre del archivo', status: false });
        });
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
})
