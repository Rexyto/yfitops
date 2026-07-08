export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <h1>Política de Privacidad</h1>
      <div className="legal-updated">Última actualización: Julio 2026</div>

      <p>
        En YFitops nos tomamos en serio la privacidad de nuestros usuarios.
        Este documento explica qué información recopilamos, cómo la usamos y
        qué derechos tienes sobre ella.
      </p>

      <h2>1. Información que recopilamos</h2>
      <ul>
        <li>Datos de cuenta: nombre de usuario y contraseña (almacenada de forma cifrada).</li>
        <li>Datos de uso: canciones reproducidas, playlists creadas y estadísticas de actividad.</li>
        <li>Datos técnicos: dirección IP, tipo de dispositivo y registros de acceso, con fines de seguridad.</li>
      </ul>

      <h2>2. Cómo usamos tu información</h2>
      <p>
        Utilizamos los datos exclusivamente para ofrecer el servicio: autenticarte,
        mostrar tus estadísticas de escucha, sincronizar tus playlists entre
        dispositivos y mantener la seguridad de la plataforma.
      </p>

      <h2>3. Con quién compartimos datos</h2>
      <p>
        No vendemos ni compartimos tu información personal con terceros. Los
        datos permanecen almacenados en el servidor de YFitops y solo son
        accesibles por los administradores del sistema.
      </p>

      <h2>4. Seguridad</h2>
      <p>
        Aplicamos medidas razonables para proteger tu información, incluyendo
        el cifrado de contraseñas y el acceso restringido mediante claves de
        API para integraciones de bots.
      </p>

      <h2>5. Tus derechos</h2>
      <p>
        Puedes solicitar la eliminación de tu cuenta y de los datos asociados
        en cualquier momento contactando a un administrador del sistema.
      </p>

      <h2>6. Cambios en esta política</h2>
      <p>
        Podemos actualizar esta política ocasionalmente. Los cambios
        relevantes se anunciarán dentro de la aplicación.
      </p>
    </div>
  );
}
