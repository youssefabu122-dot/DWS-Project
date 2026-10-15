class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function errorHandler(err, req, res, next) {
  if (res.headersSent){
     return next(err);
  }
  if (err instanceof ApiError){
     return res.status(err.status).json({error: err.message});
  }

  if (err.type === 'entity.parse.failed'){
     return res.status(400).json({error: 'Malformed JSON'});
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({error: 'Body exceeds 16 KB'});
  }
  if (err.status === 400){ 
    return res.status(400).json({error: 'Invalid request'});
  }

  const messages = {
    ER_DUP_ENTRY: [409, 'Duplicate value or resource already exists'],
    ER_ROW_IS_REFERENCED_2: [409, 'Resource has dependent records'],
    ER_NO_REFERENCED_ROW_2: [404, 'Referenced resource does not exist'],
    ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Database constraint violated'],
    ER_LOCK_DEADLOCK: [409, 'Concurrent change; retry the request'],
    ER_LOCK_WAIT_TIMEOUT: [409, 'Concurrent change; retry the request']
  };

  if (messages[err.code]) {
    const [status, error] = messages[err.code]; return res.status(status).json({error});
  }
  console.error('Request failed:', err.code || err.name);
  res.status(500).json({error: 'Internal server error'});
  
}
module.exports = {ApiError, errorHandler};
