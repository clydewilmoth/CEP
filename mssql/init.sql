-- Datenbank 'test' erstellen falls sie nicht existiert
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'test')
BEGIN
    CREATE DATABASE [test];
    PRINT 'Datenbank "test" wurde erfolgreich erstellt.';
END
ELSE
BEGIN
    PRINT 'Datenbank "test" existiert bereits.';
END
GO
