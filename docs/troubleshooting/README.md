# Troubleshooting Guide

This directory contains troubleshooting guides for common issues in the Okazje Plus platform.

## Available Guides

### Import & Integration Issues
- **[Import Jobs Not Working](./IMPORT_JOBS_NOT_WORKING.md)** - Comprehensive guide for fixing "Utwórz nowy job importu" when it's not importing products. Covers AliExpress API configuration, validation, and error handling.

## Quick Diagnosis

### Issue: Jobs not importing products
**Symptoms:** Jobs complete with 0 products, yellow warning banner in UI
**Solution:** Check [Import Jobs Not Working](./IMPORT_JOBS_NOT_WORKING.md)

### Issue: AliExpress API errors
**Symptoms:** 503 errors, authentication failures, missing credentials
**Solution:** Check [Import Jobs Not Working](./IMPORT_JOBS_NOT_WORKING.md#solution)

## Getting Help

If you can't find a solution here:

1. Check the main documentation in [`docs/`](../)
2. Review server logs for detailed error messages
3. Check Firebase Console for database/auth issues
4. Verify all required environment variables are set

## Contributing

Found a solution to a common issue? Add it here:

1. Create a new markdown file with clear problem/solution structure
2. Add it to this README
3. Cross-reference from main docs INDEX
