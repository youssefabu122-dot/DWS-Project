-- D9 least privilege (DAC): the application account may only read and write rows.
-- No CREATE, ALTER, DROP or GRANT OPTION, so even a successful SQL injection
-- could not change or drop the schema. Runs once, as root, on a fresh volume.
-- The Docker entrypoint grants ALL on `d2\_test` (underscore escaped), so the same name is used here.
REVOKE ALL PRIVILEGES ON `d2\_test`.* FROM 'rosca'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `d2\_test`.* TO 'rosca'@'%';
