import { Connection, EntityManager, getConnection, getManager } from 'typeorm';
import * as changeCase from 'change-object-case';
import { GL } from './global';

// orm tool
const conn = (): Connection => getConnection();
const mann = (): EntityManager => getManager();
const sqlBuild = () => mann().createQueryBuilder();
const sqlQuery = (s: string, p: any[] = []) => getManager().query(s, p);
const sqlProc = (sp: string, params: Record<string, unknown>) => {
  const paramsStr = Object.keys(params)
    .map((key, index) => `@${key}=@${index}`)
    .join(', ');
  const queryStr = `EXEC ${sp} ${paramsStr}`;

  return mann().query(queryStr, Object.values(params));
};

const sqlSelect = async (tableName, conditions, changeKeys = true): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const list = await sqlBuild().from(tableName, '').where(sqlWhereAnd(snakeConditions), snakeConditions).getRawMany();
  return changeKeys ? list.map((item) => changeCase.camelKeys(item)) : list;
};

const sqlSelectOne = async (tableName, conditions, changeKeys = true): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const data = await sqlBuild().from(tableName, '').where(sqlWhereAnd(snakeConditions), snakeConditions).getRawOne();
  return changeKeys ? changeCase.camelKeys(data) : data;
};

const sqlSelectCount = async (tableName, conditions, changeKeys = true, extraWhere = ''): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const data = await sqlBuild()
    .select('COUNT(*)', 'count')
    .from(tableName, '')
    .where(sqlWhereAnd(snakeConditions, extraWhere), snakeConditions)
    .getRawOne();
  return changeKeys ? changeCase.camelKeys(data) : data;
};

const sqlSelectAndLikeCount = async (tableName, conditions, changeKeys = true, extraWhere = ''): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const data = await sqlBuild()
    .select('COUNT(*)', 'count')
    .from(tableName, '')
    .where(sqlWhereAndLike(snakeConditions, extraWhere), snakeConditions)
    .getRawOne();
  return changeKeys ? changeCase.camelKeys(data) : data;
};

const sqlExist = async (tableName, conditions, changeKeys = true): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const exists = await sqlBuild().from(tableName, '').where(sqlWhereAnd(snakeConditions), snakeConditions).getRawMany();
  return exists.length > 0;
};

const sqlInsert = async (tableName, values, changeKeys = true): Promise<any> => {
  const snakeValues = changeKeys ? changeCase.snakeKeys(values) : values;
  const result = await sqlBuild().insert().into(tableName).values(snakeValues).execute();
  return result;
};

const sqlUpdate = async (tableName, conditions, values, changeKeys = true): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const snakeValues = changeKeys ? changeCase.snakeKeys(values) : values;
  const result = await sqlBuild()
    .update(tableName)
    .set(snakeValues)
    .where(sqlWhereAnd(snakeConditions), snakeConditions)
    .execute();
  return result;
};

const sqlSave = async (tableName, conditions, values, changeKeys = true): Promise<any> => {
  let result = true;
  try {
    const exists = await sqlExist(tableName, conditions, changeKeys);
    if (exists) {
      await sqlUpdate(tableName, conditions, values, changeKeys);
    } else {
      await sqlInsert(tableName, values, changeKeys);
    }
    result = true;
  } catch (err) {
    result = false;
    GL.dumpError(err);
  }
  return new Promise((rs) => rs(result));
};

const sqlDelete = async (tableName, ids, primayKey = 'id'): Promise<any> => {
  const result = await sqlBuild().delete().from(tableName).where(`${primayKey} IN(:...ids)`, { ids: ids }).execute();
  return result;
};

const sqlDeleteOne = async (tableName, conditions, changeKeys, extraWhere = ''): Promise<any> => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const result = await sqlBuild()
    .delete()
    .from(tableName)
    .where(sqlWhereAnd(snakeConditions, extraWhere), snakeConditions)
    .execute();
  return result;
};

const sqlWhereAnd = (conditions, extraWhere = '') =>
  Object.keys(conditions)
    .map((item) => item + ' = :' + item)
    .join(' AND ') + (extraWhere ? extraWhere : '');
const sqlWhereAndLike = (conditions, extraWhere = '') =>
  Object.keys(conditions)
    .map((item) => item + ' LIKE :' + item)
    .join(' AND ') + (extraWhere ? extraWhere : '');
const sqlWhereOr = (conditions, extraWhere) =>
  Object.keys(conditions)
    .map((item) => item + ' = :' + item)
    .join(' OR ') + (extraWhere ? extraWhere : '');
const sqlWhereOrLike = (conditions, extraWhere) =>
  Object.keys(conditions)
    .map((item) => item + ' LIKE :' + item)
    .join(' OR ') + (extraWhere ? extraWhere : '');

const sqlViewAnd = async (tableName, conditions, changeKeys = true, extraWhere = '') => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const sqlView = await RawSQL.sqlBuild()
    .from(tableName, '')
    .where(RawSQL.sqlWhereAnd(snakeConditions, extraWhere), snakeConditions);
  return sqlView;
};

const sqlViewAndLike = async (tableName, conditions, changeKeys = true, extraWhere = '') => {
  const snakeConditions = changeKeys ? changeCase.snakeKeys(conditions, { recursive: false }) : conditions;
  const sqlView = await RawSQL.sqlBuild()
    .from(tableName, '')
    .where(RawSQL.sqlWhereAndLike(snakeConditions, extraWhere), snakeConditions);
  return sqlView;
};

const sqlPageAnd = async (
  tableName,
  conditions,
  pageNumber,
  pageSize,
  orderCol = 'id',
  asc = false,
  changeKeys = true,
  extraWhere = '',
) => {
  const skipSize = (pageNumber - 1) * pageSize;
  const sqlView = await RawSQL.sqlViewAnd(tableName, conditions, changeKeys, extraWhere);
  const total = (await sqlSelectCount(tableName, conditions, changeKeys, extraWhere)).count;
  const list = await sqlView
    .orderBy(orderCol, asc ? 'ASC' : 'DESC')
    .skip(skipSize)
    .take(pageSize)
    .getRawMany();

  const pageData = {
    total: total,
    list: total > 0 ? (changeKeys ? useCamelKeys(list) : list) : [],
  };

  return pageData;
};

const sqlPageAndLike = async (
  tableName,
  conditions,
  pageNumber,
  pageSize,
  orderCol = 'id',
  asc = false,
  changeKeys = true,
  extraWhere = '',
) => {
  const skipSize = (pageNumber - 1) * pageSize;
  const sqlView = await RawSQL.sqlViewAndLike(tableName, conditions, changeKeys, extraWhere);
  const total = (await sqlSelectAndLikeCount(tableName, conditions, changeKeys, extraWhere)).count;
  const list = await sqlView
    .orderBy(orderCol, asc ? 'ASC' : 'DESC')
    .skip(skipSize)
    .take(pageSize)
    .getRawMany();

  const pageData = {
    total: total,
    list: total > 0 ? (changeKeys ? useCamelKeys(list) : list) : [],
  };

  return pageData;
};

const useCamelKeys = (data, recursive = false) =>
  Array.isArray(data)
    ? data.map((item) => changeCase.camelKeys(item, { recursive: recursive }))
    : changeCase.camelKeys(data, { recursive: recursive });

const useSnakeKeys = (data, recursive = false) =>
  Array.isArray(data)
    ? data.map((item) => changeCase.snakeKeys(item, { recursive: recursive }))
    : changeCase.snakeKeys(data, { recursive: recursive });

const RawSQL = {
  conn,
  mann,
  sqlBuild,
  sqlQuery,
  sqlProc,
  sqlSelect,
  sqlSelectOne,
  sqlSelectCount,
  sqlSelectAndLikeCount,
  sqlExist,
  sqlInsert,
  sqlUpdate,
  sqlSave,
  sqlDelete,
  sqlDeleteOne,
  sqlWhereAnd,
  sqlWhereAndLike,
  sqlWhereOr,
  sqlWhereOrLike,
  sqlViewAnd,
  sqlViewAndLike,
  sqlPageAnd,
  sqlPageAndLike,
  useCamelKeys,
  useSnakeKeys,
};

// export as tool
export { RawSQL };
