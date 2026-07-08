const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.jsx',
  // 'web' normal, no 'electron-renderer': aquí no hay proceso Node/Electron,
  // es un navegador Tizen puro dentro de la TV.
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              // target navegador Tizen 4.x (Chromium ~56) — evitamos JS demasiado moderno
              ['@babel/preset-env', { targets: { chrome: '56' } }],
              '@babel/preset-react',
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        type: 'asset/resource',
        generator: { filename: 'assets/[name][ext]' },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.', noErrorOnMissing: true },
        // config.xml tiene que ir en la RAÍZ del paquete .wgt, junto a
        // index.html, para que Tizen Studio reconozca el proyecto.
        { from: 'config.xml', to: '.' },
        // El icono de la app en el menú "Apps" de la TV se genera SIEMPRE
        // a partir de public/logo.png (una única fuente de verdad): así,
        // para cambiar el logo real de YFitops solo hay que reemplazar
        // ese archivo y no hay que tocar nada más ni mantener dos imágenes
        // distintas sincronizadas a mano.
        { from: 'public/logo.png', to: 'icon.png' },
      ],
    }),
  ],
  // Sourcemaps ligeros; en TV no hace falta devtools pesado
  devtool: 'source-map',
};
