using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace CooperativeRecords.DatabaseServer
{
    internal static class Program
    {
        private static Mutex instance;
        [STAThread]
        private static void Main(string[] args)
        {
            bool created;
            instance = new Mutex(true, "CooperativeRecords.DatabaseServer", out created);
            if (!created) { MessageBox.Show("The database server is already running.", "Cooperative Records"); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ServerForm(ParsePort(args)));
            instance.ReleaseMutex();
        }
        private static int ParsePort(string[] args)
        {
            foreach (string arg in args) { int port; if (arg.StartsWith("--port=") && Int32.TryParse(arg.Substring(7), out port)) return port; }
            return 8787;
        }
    }

    internal sealed class ServerForm : Form
    {
        private readonly int port;
        private Process engine;
        private readonly Label status;
        private readonly Label address;
        private readonly Label database;
        private readonly Button open;
        private readonly NotifyIcon tray;
        private bool terminating;

        public ServerForm(int selectedPort)
        {
            port = selectedPort;
            Text = "Cooperative Records Database Server";
            Icon = SystemIcons.Application;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            ClientSize = new Size(590, 326);
            BackColor = Color.FromArgb(246, 248, 246);
            Font = new Font("Segoe UI", 9F);

            Label title = NewLabel("Cooperative Records", 24, 20, 18F, true, Color.FromArgb(24, 37, 29));
            Controls.Add(title);
            Controls.Add(NewLabel("SQLite database server for local network and hybrid deployments", 27, 57, 9F, false, Color.FromArgb(95, 107, 99)));

            Panel panel = new Panel { Location = new Point(24, 88), Size = new Size(542, 132), BackColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            Controls.Add(panel);
            status = NewLabel("Starting database server...", 16, 13, 10F, true, Color.FromArgb(40, 124, 87)); panel.Controls.Add(status);
            address = NewLabel("Detecting network address...", 16, 43, 10F, false, Color.FromArgb(31, 80, 57)); address.Font = new Font("Consolas", 10F); address.Size = new Size(505, 22); panel.Controls.Add(address);
            database = NewLabel("Database: preparing data folder...", 16, 75, 9F, false, Color.FromArgb(80, 91, 84)); database.Size = new Size(505, 40); panel.Controls.Add(database);

            Controls.Add(NewLabel("Keep this window running. The .db-wal and .db-shm files are managed automatically while the server is active.", 26, 231, 9F, false, Color.FromArgb(95, 107, 99)));
            open = NewButton("Open browser", 24, 274, 122, Color.FromArgb(31, 80, 57), Color.White); open.Enabled = false; open.Click += delegate { LaunchBrowser(); }; Controls.Add(open);
            Button copy = NewButton("Copy address", 154, 274, 122, Color.White, Color.FromArgb(31, 80, 57)); copy.Click += delegate { Clipboard.SetText(address.Text); }; Controls.Add(copy);
            Button hide = NewButton("Hide", 284, 274, 96, Color.White, Color.FromArgb(61, 70, 64)); hide.Click += delegate { HideToTray(); }; Controls.Add(hide);
            Button stop = NewButton("Terminate", 444, 274, 122, Color.FromArgb(153, 45, 45), Color.White); stop.Click += delegate { Terminate(); }; Controls.Add(stop);

            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("Show", null, delegate { Show(); WindowState = FormWindowState.Normal; Activate(); });
            menu.Items.Add("Open browser", null, delegate { LaunchBrowser(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Terminate", null, delegate { Terminate(); });
            tray = new NotifyIcon { Text = "Cooperative Records Database Server", Icon = SystemIcons.Application, ContextMenuStrip = menu, Visible = true };
            tray.DoubleClick += delegate { Show(); WindowState = FormWindowState.Normal; Activate(); };
            Shown += delegate { StartEngine(); };
            FormClosing += OnFormClosing;
        }

        private void StartEngine()
        {
            try
            {
                string root = AppDomain.CurrentDomain.BaseDirectory;
                string dataDir = Path.Combine(root, "data");
                string runtimeDir = Path.Combine(dataDir, "runtime");
                Directory.CreateDirectory(runtimeDir);
                string enginePath = Path.Combine(runtimeDir, "CooperativeRecordsDatabaseEngine.exe");
                using (Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream("CooperativeRecords.DatabaseEngine.exe"))
                {
                    if (source == null) throw new InvalidOperationException("The embedded database engine is missing.");
                    bool replace = !File.Exists(enginePath) || new FileInfo(enginePath).Length != source.Length;
                    if (replace) { using (FileStream target = File.Create(enginePath)) source.CopyTo(target); }
                }
                ProcessStartInfo info = new ProcessStartInfo(enginePath, "--port=" + port + " --data-dir=\"" + dataDir + "\"");
                info.UseShellExecute = false; info.CreateNoWindow = true; info.WindowStyle = ProcessWindowStyle.Hidden; info.RedirectStandardOutput = true; info.RedirectStandardError = true;
                engine = new Process { StartInfo = info, EnableRaisingEvents = true };
                engine.OutputDataReceived += Output;
                engine.ErrorDataReceived += ErrorOutput;
                engine.Exited += delegate { BeginInvoke((MethodInvoker)delegate { if (!terminating) { status.Text = "Server stopped unexpectedly"; status.ForeColor = Color.FromArgb(153, 45, 45); open.Enabled = false; } }); };
                engine.Start(); engine.BeginOutputReadLine(); engine.BeginErrorReadLine();
            }
            catch (Exception error) { Fail(error.Message); }
        }

        private void Output(object sender, DataReceivedEventArgs eventArgs)
        {
            if (String.IsNullOrEmpty(eventArgs.Data) || !eventArgs.Data.StartsWith("READY|")) return;
            string[] parts = eventArgs.Data.Split('|');
            BeginInvoke((MethodInvoker)delegate {
                status.Text = "Database server is running (SQLite WAL)";
                address.Text = "http://" + FindAddress() + ":" + port + "/";
                database.Text = "Database: " + (parts.Length > 2 ? parts[2] : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data", "cooperative-records.db"));
                open.Enabled = true;
            });
        }
        private void ErrorOutput(object sender, DataReceivedEventArgs eventArgs) { if (!String.IsNullOrWhiteSpace(eventArgs.Data)) BeginInvoke((MethodInvoker)delegate { database.Text = eventArgs.Data; }); }
        private void Fail(string message) { status.Text = "Server failed to start"; status.ForeColor = Color.FromArgb(153, 45, 45); database.Text = message; MessageBox.Show(message, "Server startup failed", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        private void LaunchBrowser() { try { Process.Start("http://127.0.0.1:" + port + "/"); } catch (Exception error) { MessageBox.Show(error.Message); } }
        private void HideToTray() { Hide(); tray.ShowBalloonTip(2200, "Cooperative Records", "The database server is still running.", ToolTipIcon.Info); }
        private void OnFormClosing(object sender, FormClosingEventArgs args) { if (!terminating) { args.Cancel = true; HideToTray(); } }
        private void Terminate() { terminating = true; try { if (engine != null && !engine.HasExited) { engine.Kill(); engine.WaitForExit(3000); } } catch {} tray.Visible = false; tray.Dispose(); Close(); Application.Exit(); }

        private static Label NewLabel(string text, int x, int y, float size, bool bold, Color color) { return new Label { Text = text, Location = new Point(x, y), AutoSize = true, Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular), ForeColor = color }; }
        private static Button NewButton(string text, int x, int y, int width, Color background, Color foreground) { return new Button { Text = text, Location = new Point(x, y), Size = new Size(width, 35), FlatStyle = FlatStyle.Flat, BackColor = background, ForeColor = foreground, Cursor = Cursors.Hand }; }
        private static string FindAddress()
        {
            try
            {
                var candidates = NetworkInterface.GetAllNetworkInterfaces()
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
    }
}
