using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace CooperativeRecords.Server
{
    internal static class Program
    {
        private static Mutex singleInstance;

        [STAThread]
        private static void Main(string[] args)
        {
            bool created;
            singleInstance = new Mutex(true, "CooperativeRecords.LanServer", out created);
            if (!created)
            {
                MessageBox.Show("Cooperative Records Server is already running.", "Cooperative Records", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            int port = ParsePort(args);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ServerForm(port));
            singleInstance.ReleaseMutex();
        }

        private static int ParsePort(string[] args)
        {
            foreach (string arg in args)
            {
                if (!arg.StartsWith("--port=", StringComparison.OrdinalIgnoreCase)) continue;
                int value;
                if (int.TryParse(arg.Substring(7), out value) && value >= 1024 && value <= 65535) return value;
            }
            return 8787;
        }
    }

    internal sealed class ServerForm : Form
    {
        private readonly MiniWebServer server;
        private readonly NotifyIcon tray;
        private readonly Label statusLabel;
        private readonly Label addressLabel;
        private readonly Button openButton;
        private bool terminating;

        public ServerForm(int port)
        {
            Text = "Cooperative Records Server";
            Icon = SystemIcons.Application;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            ClientSize = new Size(560, 286);
            BackColor = Color.FromArgb(246, 248, 246);
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            Label title = new Label();
            title.Text = "Cooperative Records";
            title.Font = new Font("Segoe UI Semibold", 17F, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(24, 37, 29);
            title.AutoSize = true;
            title.Location = new Point(24, 21);
            Controls.Add(title);

            Label caption = new Label();
            caption.Text = "Local network application server";
            caption.ForeColor = Color.FromArgb(100, 111, 104);
            caption.AutoSize = true;
            caption.Location = new Point(27, 56);
            Controls.Add(caption);

            Panel statusPanel = new Panel();
            statusPanel.Location = new Point(24, 88);
            statusPanel.Size = new Size(512, 92);
            statusPanel.BackColor = Color.White;
            statusPanel.BorderStyle = BorderStyle.FixedSingle;
            Controls.Add(statusPanel);

            statusLabel = new Label();
            statusLabel.Text = "Starting server...";
            statusLabel.Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold);
            statusLabel.ForeColor = Color.FromArgb(40, 124, 87);
            statusLabel.AutoSize = true;
            statusLabel.Location = new Point(16, 14);
            statusPanel.Controls.Add(statusLabel);

            addressLabel = new Label();
            addressLabel.Text = "Detecting network address...";
            addressLabel.Font = new Font("Consolas", 10F, FontStyle.Regular);
            addressLabel.ForeColor = Color.FromArgb(31, 80, 57);
            addressLabel.AutoEllipsis = true;
            addressLabel.Location = new Point(16, 43);
            addressLabel.Size = new Size(477, 23);
            statusPanel.Controls.Add(addressLabel);

            Label note = new Label();
            note.Text = "LAN access serves the application to other devices. Shared records require the build to use configured Supabase ONLINE mode.";
            note.ForeColor = Color.FromArgb(105, 113, 108);
            note.Location = new Point(26, 190);
            note.Size = new Size(510, 34);
            Controls.Add(note);

            openButton = CreateButton("Open browser", new Point(24, 236), 116, Color.FromArgb(31, 80, 57), Color.White);
            openButton.Click += delegate { OpenBrowser(); };
            Controls.Add(openButton);

            Button copyButton = CreateButton("Copy address", new Point(148, 236), 116, Color.White, Color.FromArgb(31, 80, 57));
            copyButton.Click += delegate { Clipboard.SetText(server.PublicUrl); };
            Controls.Add(copyButton);

            Button hideButton = CreateButton("Hide", new Point(272, 236), 100, Color.White, Color.FromArgb(61, 70, 64));
            hideButton.Click += delegate { HideToTray(); };
            Controls.Add(hideButton);

            Button stopButton = CreateButton("Terminate", new Point(420, 236), 116, Color.FromArgb(153, 45, 45), Color.White);
            stopButton.Click += delegate { TerminateServer(); };
            Controls.Add(stopButton);

            ContextMenuStrip trayMenu = new ContextMenuStrip();
            trayMenu.Items.Add("Show", null, delegate { RestoreFromTray(); });
            trayMenu.Items.Add("Open browser", null, delegate { OpenBrowser(); });
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add("Terminate", null, delegate { TerminateServer(); });
            tray = new NotifyIcon();
            tray.Text = "Cooperative Records Server";
            tray.Icon = SystemIcons.Application;
            tray.ContextMenuStrip = trayMenu;
            tray.Visible = true;
            tray.DoubleClick += delegate { RestoreFromTray(); };

            server = new MiniWebServer(port);
            Shown += delegate { StartServer(); };
            FormClosing += OnFormClosing;
        }

        private static Button CreateButton(string text, Point location, int width, Color background, Color foreground)
        {
            Button button = new Button();
            button.Text = text;
            button.Location = location;
            button.Size = new Size(width, 34);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = Color.FromArgb(205, 214, 208);
            button.BackColor = background;
            button.ForeColor = foreground;
            button.Cursor = Cursors.Hand;
            return button;
        }

        private void StartServer()
        {
            try
            {
                server.Start();
                statusLabel.Text = "Server is running";
                addressLabel.Text = server.PublicUrl;
                openButton.Enabled = true;
            }
            catch (Exception error)
            {
                statusLabel.Text = "Server failed to start";
                statusLabel.ForeColor = Color.FromArgb(153, 45, 45);
                addressLabel.Text = error.Message;
                openButton.Enabled = false;
                MessageBox.Show(error.Message, "Server startup failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OpenBrowser()
        {
            try { Process.Start(server.LocalUrl); }
            catch (Exception error) { MessageBox.Show(error.Message, "Could not open browser", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        }

        private void HideToTray()
        {
            Hide();
            tray.ShowBalloonTip(2500, "Cooperative Records", "The server is still running. Double-click the tray icon to restore it.", ToolTipIcon.Info);
        }

        private void RestoreFromTray()
        {
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private void OnFormClosing(object sender, FormClosingEventArgs eventArgs)
        {
            if (terminating) return;
            eventArgs.Cancel = true;
            HideToTray();
        }

        private void TerminateServer()
        {
            terminating = true;
            server.Stop();
            tray.Visible = false;
            tray.Dispose();
            Close();
            Application.Exit();
        }
    }

    internal sealed class MiniWebServer
    {
        private readonly int port;
        private readonly Dictionary<string, byte[]> assets;
        private TcpListener listener;
        private Thread listenerThread;
        private volatile bool running;

        public MiniWebServer(int portNumber)
        {
            port = portNumber;
            assets = LoadAssets();
            if (!assets.ContainsKey("index.html")) throw new InvalidOperationException("The embedded application bundle is incomplete.");
        }

        public string LocalUrl { get { return "http://127.0.0.1:" + port + "/"; } }
        public string PublicUrl { get { return "http://" + FindLanAddress() + ":" + port + "/"; } }

        public void Start()
        {
            if (running) return;
            listener = new TcpListener(IPAddress.Any, port);
            listener.Start(100);
            running = true;
            listenerThread = new Thread(AcceptLoop);
            listenerThread.IsBackground = true;
            listenerThread.Name = "Cooperative Records HTTP Server";
            listenerThread.Start();
        }

        public void Stop()
        {
            running = false;
            try { if (listener != null) listener.Stop(); }
            catch { }
        }

        private void AcceptLoop()
        {
            while (running)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(delegate { HandleClient(client); });
                }
                catch (SocketException) { if (running) Thread.Sleep(100); }
                catch (ObjectDisposedException) { return; }
            }
        }

        private void HandleClient(TcpClient client)
        {
            using (client)
            {
                client.ReceiveTimeout = 5000;
                client.SendTimeout = 5000;
                NetworkStream stream = client.GetStream();
                try
                {
                    StreamReader reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true);
                    string requestLine = reader.ReadLine();
                    if (String.IsNullOrWhiteSpace(requestLine)) return;
                    string header;
                    do { header = reader.ReadLine(); } while (header != null && header.Length > 0);

                    string[] parts = requestLine.Split(' ');
                    if (parts.Length < 2 || (parts[0] != "GET" && parts[0] != "HEAD"))
                    {
                        WriteResponse(stream, 405, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Method Not Allowed"), false, false);
                        return;
                    }

                    string rawPath = parts[1].Split('?')[0];
                    string path = Uri.UnescapeDataString(rawPath).TrimStart('/').Replace('\\', '/');
                    if (path.Contains(".."))
                    {
                        WriteResponse(stream, 400, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Bad Request"), false, false);
                        return;
                    }
                    if (String.IsNullOrEmpty(path)) path = "index.html";

                    byte[] body;
                    bool immutable = path.StartsWith("assets/", StringComparison.OrdinalIgnoreCase);
                    if (!assets.TryGetValue(path, out body))
                    {
                        path = "index.html";
                        body = assets[path];
                        immutable = false;
                    }
                    WriteResponse(stream, 200, MimeType(path), body, parts[0] == "HEAD", immutable);
                }
                catch { }
            }
        }

        private static void WriteResponse(Stream stream, int status, string contentType, byte[] body, bool headOnly, bool immutable)
        {
            string statusText = status == 200 ? "OK" : status == 400 ? "Bad Request" : "Method Not Allowed";
            string cache = immutable ? "public, max-age=31536000, immutable" : "no-cache";
            string headers = "HTTP/1.1 " + status + " " + statusText + "\r\n" +
                "Content-Type: " + contentType + "\r\n" +
                "Content-Length: " + body.Length + "\r\n" +
                "Cache-Control: " + cache + "\r\n" +
                "X-Content-Type-Options: nosniff\r\n" +
                "Referrer-Policy: same-origin\r\n" +
                "Connection: close\r\n\r\n";
            byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
            stream.Write(headerBytes, 0, headerBytes.Length);
            if (!headOnly) stream.Write(body, 0, body.Length);
        }

        private static Dictionary<string, byte[]> LoadAssets()
        {
            Dictionary<string, byte[]> result = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
            Assembly assembly = Assembly.GetExecutingAssembly();
            using (Stream resource = assembly.GetManifestResourceStream("CooperativeRecords.WebAssets.zip"))
            {
                if (resource == null) throw new InvalidOperationException("Embedded web assets were not found.");
                using (ZipArchive archive = new ZipArchive(resource, ZipArchiveMode.Read, false))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (String.IsNullOrEmpty(entry.Name)) continue;
                        using (Stream input = entry.Open())
                        using (MemoryStream output = new MemoryStream())
                        {
                            input.CopyTo(output);
                            result[entry.FullName.Replace('\\', '/').TrimStart('/')] = output.ToArray();
                        }
                    }
                }
            }
            return result;
        }

        private static string FindLanAddress()
        {
            try
            {
                NetworkInterface[] networks = NetworkInterface.GetAllNetworkInterfaces();
                var candidates = networks
                    .Where(network => network.OperationalStatus == OperationalStatus.Up)
                    .Where(network => network.NetworkInterfaceType != NetworkInterfaceType.Loopback && network.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
                    .SelectMany(network => network.GetIPProperties().UnicastAddresses
                        .Where(item => item.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(item.Address))
                        .Select(item => new { Network = network, Address = item.Address }))
                    .Where(item => IsPrivateAddress(item.Address))
                    .OrderByDescending(item => AddressScore(item.Network, item.Address))
                    .ToList();
                if (candidates.Count > 0) return candidates[0].Address.ToString();
            }
            catch { }
            return "127.0.0.1";
        }

        private static int AddressScore(NetworkInterface network, IPAddress address)
        {
            int score = HasDefaultGateway(network) ? 100 : 0;
            if (network.NetworkInterfaceType == NetworkInterfaceType.Ethernet || network.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 || network.NetworkInterfaceType == NetworkInterfaceType.GigabitEthernet || network.NetworkInterfaceType == NetworkInterfaceType.FastEthernetFx || network.NetworkInterfaceType == NetworkInterfaceType.FastEthernetT) score += 50;
            byte[] bytes = address.GetAddressBytes();
            if (bytes[0] == 192 && bytes[1] == 168) score += 20;
            else if (bytes[0] == 10) score += 10;
            if (IsVirtualAdapter(network)) score -= 500;
            return score;
        }

        private static bool HasDefaultGateway(NetworkInterface network)
        {
            try { return network.GetIPProperties().GatewayAddresses.Any(item => item.Address.AddressFamily == AddressFamily.InterNetwork && !item.Address.Equals(IPAddress.Any)); }
            catch { return false; }
        }

        private static bool IsVirtualAdapter(NetworkInterface network)
        {
            string value = (network.Name + " " + network.Description).ToLowerInvariant();
            string[] markers = { "virtual", "hyper-v", "vethernet", "vmware", "virtualbox", "docker", "wsl", "vpn", "tap", "tunnel", "bluetooth" };
            return markers.Any(value.Contains);
        }

        private static bool IsPrivateAddress(IPAddress address)
        {
            byte[] bytes = address.GetAddressBytes();
            return bytes[0] == 10 || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) || (bytes[0] == 192 && bytes[1] == 168);
        }

        private static string MimeType(string path)
        {
            string extension = Path.GetExtension(path).ToLowerInvariant();
            if (extension == ".html") return "text/html; charset=utf-8";
            if (extension == ".js" || extension == ".mjs") return "text/javascript; charset=utf-8";
            if (extension == ".css") return "text/css; charset=utf-8";
            if (extension == ".json" || extension == ".map") return "application/json; charset=utf-8";
            if (extension == ".svg") return "image/svg+xml";
            if (extension == ".png") return "image/png";
            if (extension == ".jpg" || extension == ".jpeg") return "image/jpeg";
            if (extension == ".webp") return "image/webp";
            if (extension == ".ico") return "image/x-icon";
            if (extension == ".woff") return "font/woff";
            if (extension == ".woff2") return "font/woff2";
            return "application/octet-stream";
        }
    }
}
