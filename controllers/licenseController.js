import { validationResult } from 'express-validator';
import { auditLicenseEvent } from '../modules/licenses/auditLogger.js';
import { makeSignedBody } from '../modules/licenses/crypto.js';
import {
  createLicense,
  listActivations,
  listLicenses,
  revokeLicense,
} from '../modules/licenses/licenseService.js';

function validationErrorResponse(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json(makeSignedBody({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  }));
  return true;
}

function handleLicenseError(res, error) {
  const status = error.status || 500;
  res.status(status).json(makeSignedBody({
    success: false,
    message: status >= 500 ? 'Internal server error' : error.message,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  }));
}

function parsePagination(query) {
  return {
    limit: Number.parseInt(query.limit || '100', 10),
    offset: Number.parseInt(query.offset || '0', 10),
  };
}

export async function getLicenses(req, res) {
  if (validationErrorResponse(req, res)) return;

  try {
    const revoked = req.query.revoked === undefined ? undefined : req.query.revoked === 'true';
    const data = await listLicenses({ ...parsePagination(req.query), revoked });
    auditLicenseEvent('license_list', req, { count: data.records.length });
    res.json(makeSignedBody({ success: true, data }));
  } catch (error) {
    console.error('Error listing licenses:', error);
    handleLicenseError(res, error);
  }
}

export async function postCreateLicense(req, res) {
  if (validationErrorResponse(req, res)) return;

  try {
    const license = await createLicense(req.body);
    auditLicenseEvent('license_create', req, {
      license_key: license.license_key,
      tier: license.tier,
      expiry: license.expiry,
    });
    res.status(201).json(makeSignedBody({ success: true, data: license }));
  } catch (error) {
    console.error('Error creating license:', error);
    handleLicenseError(res, error);
  }
}

export async function postRevokeLicense(req, res) {
  if (validationErrorResponse(req, res)) return;

  try {
    const license = await revokeLicense(req.body);
    auditLicenseEvent('license_revoke', req, { license_key: license.license_key });
    res.json(makeSignedBody({
      success: true,
      message: 'License revoked instantly',
      data: license,
    }));
  } catch (error) {
    console.error('Error revoking license:', error);
    handleLicenseError(res, error);
  }
}

export async function getLicenseActivations(req, res) {
  if (validationErrorResponse(req, res)) return;

  try {
    const data = await listActivations({
      ...parsePagination(req.query),
      license_key: req.query.license_key,
    });
    auditLicenseEvent('license_activation_list', req, { count: data.records.length });
    res.json(makeSignedBody({ success: true, data }));
  } catch (error) {
    console.error('Error listing license activations:', error);
    handleLicenseError(res, error);
  }
}
