# Cooperative Records Database Server

## Build

Run `build-database-exe.bat` from the repository root. The database edition is
created at:

`release\windows-database-server\CooperativeRecordsDatabaseServer.exe`

The existing `build-exe.bat` remains the browser-local edition.

## Deploy

Copy the database server EXE to a writable folder on the host computer and run
it there. On first run it creates:

- `data\cooperative-records.db` - durable SQLite database
- `data\cooperative-records.db-wal` - active write-ahead log
- `data\cooperative-records.db-shm` - WAL shared-memory index
- `data\server-config.json` - LAN/hybrid host settings
- `data\runtime\` - extracted embedded server engine

Other computers and phones use the LAN URL displayed by the controller. They
must not open the database file from a Windows share. All reads and writes go
through the host HTTP API, which serializes SQLite writes and applies RBAC.

Default first sign-in:

- Email: `admin@example.test`
- Password: `ChangeMe123!`

The password must be changed immediately after signing in.

## WAL and backup

WAL is enabled automatically with a ten-second busy timeout. The `-wal` and
`-shm` files are runtime companion files, not separate databases, and may be
removed by SQLite after a clean shutdown.

For a filesystem backup, terminate the server first and copy the complete
`data` folder. Do not copy only the main `.db` file while the server is running.

## Hybrid mode

Open **Synchronization** as Super Admin, select **Hybrid**, and enter the URL
and matching replication key for another deployed Cooperative Records database
server. Manual and interval-based synchronization use last-modified conflict
resolution per stored record group. Use HTTPS when the remote server is exposed
outside a trusted private network.
