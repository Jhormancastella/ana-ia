# ANA-IA - Analizador de Imágenes con Inteligencia Artificial

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with TensorFlow.js](https://img.shields.io/badge/Made%20with-TensorFlow.js-orange.svg)](https://www.tensorflow.org/js)
[![Hosted Status](https://img.shields.io/badge/Status-Ready-brightgreen.svg)](https://tu-dominio.com/)

**ANA-IA** es una aplicación web completamente funcional y elegante que analiza imágenes con inteligencia artificial directamente en tu navegador, extrae paletas de colores, estilos y genera prompts detallados perfectos para usar en Midjourney, DALL-E y Stable Diffusion.

---

## ✨ Características Principales

- 🤖 **Análisis de Imágenes con IA**: Usa TensorFlow.js y MobileNet para clasificar objetos en tus imágenes.
- 🎨 **Extracción de Paleta de Colores**: Identifica automáticamente los colores dominantes de cualquier imagen.
- 📝 **Generación de Prompts**: Crea prompts detallados y optimizados para IA generativa en segundos.
- 📱 **100% Responsive**: Diseño adaptado para móviles, tabletas y escritorio.
- 🌍 **Idiomas**: Soporte para Español e Inglés.
- 📂 **Historial de Análisis**: Guarda y gestiona tu historial de análisis localmente.
- ✨ **UI Moderna y Elegante**: Diseño glassmorphism con animaciones suaves.
- 🔒 **Sin Servidores**: Funciona completamente en el navegador, no envía datos a ningún servidor.

---

## 📁 Estructura del Proyecto

```
ana/
├── assets/
│   └── images/
│       └── logo.png                # Logo de la aplicación
├── css/
│   └── style.css                   # Estilos CSS
├── js/
│   ├── app.js                      # Lógica principal
│   └── history.js                  # Manejo del historial
├── index.html                      # Archivo principal
├── manifest.json                   # Manifest para PWA
├── sitemap.xml                     # Sitemap para SEO
├── robots.txt                      # Reglas para crawlers
├── server.js                       # Servidor de desarrollo
└── README.md                       # Este archivo
```

---

## 🚀 Cómo Empezar

### Requisitos

- Un navegador web moderno (Chrome, Firefox, Safari, Edge).
- (Opcional) Node.js para usar el servidor de desarrollo.

### Instalación y Uso

1. **Clona o descarga el repositorio**
   ```bash
   # Si usas git
   git clone <tu-repositorio>
   cd ana
   ```

2. **Abre el proyecto**
   - **Modo Simple**: Abre directamente `index.html` en tu navegador.
   - **Modo Desarrollador**: Usa el servidor Node.js:
     ```bash
     node server.js
     ```
     Luego abre `http://localhost:3000` en tu navegador.

3. **Usa la app**
   - Arrastra y suelta una imagen o haz clic para seleccionar un archivo.
   - Espera a que termine el análisis.
   - Copia el prompt generado y úsalo en tu IA favorita!

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Versión | Descripción |
|------------|---------|-------------|
| HTML5 | - | Estructura de la aplicación |
| CSS3 | - | Estilos y diseño responsive |
| JavaScript (ES6+) | - | Lógica de la aplicación |
| [TensorFlow.js](https://www.tensorflow.org/js) | 4.17.0 | Framework para IA en el navegador |
| [MobileNet](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet) | 2.1.1 | Modelo preentrenado para clasificación |
| [Font Awesome](https://fontawesome.com/) | 6.5.1 | Íconos |
| [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter) | - | Tipografía |

---

## 📝 Licencia

Distribuido bajo la Licencia MIT. Consulta `LICENSE` para más información.

---

## 👥 Autor

**tibutec** - [tu-sitio-web](https://tu-dominio.com/)

---

## 📧 Contacto

Si tienes preguntas o sugerencias, ¡no dudes en contactarme!
