/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { isEmpty, isNumber, get } from 'lodash/fp';
import memoizeOne from 'memoize-one';
import { StaticIndexPattern } from 'ui/index_patterns';

import { convertKueryToElasticSearchQuery, escapeQueryValue } from '../../lib/keury';

import { DataProvider, DataProvidersAnd, EXISTS_OPERATOR } from './data_providers/data_provider';
import { BrowserFields } from '../../containers/source';

const convertDateFieldToQuery = (field: string, value: string | number) =>
  `${field}: ${isNumber(value) ? value : new Date(value).valueOf()}`;

const getBaseFields = memoizeOne((browserFields: BrowserFields): string[] => {
  const baseFields = get('base', browserFields);
  if (baseFields != null && baseFields.fields != null) {
    return Object.keys(baseFields.fields);
  }
  return [];
});

const getBrowserFieldPath = (field: string, browserFields: BrowserFields) => {
  const splitFields = field.split('.');
  const baseFields = getBaseFields(browserFields);
  if (baseFields.includes(field)) {
    return ['base', 'fields', field];
  }
  return [splitFields[0], 'fields', field];
};

const checkIfFieldTypeIsDate = (field: string, browserFields: BrowserFields) => {
  const pathBrowserField = getBrowserFieldPath(field, browserFields);
  const browserField = get(pathBrowserField, browserFields);
  if (browserField != null && browserField.type === 'date') {
    return true;
  }
  return false;
};

const buildQueryMatch = (
  dataProvider: DataProvider | DataProvidersAnd,
  browserFields: BrowserFields
) =>
  `${dataProvider.excluded ? 'NOT ' : ''}${
    dataProvider.queryMatch.operator !== EXISTS_OPERATOR
      ? checkIfFieldTypeIsDate(dataProvider.queryMatch.field, browserFields)
        ? convertDateFieldToQuery(dataProvider.queryMatch.field, dataProvider.queryMatch.value)
        : `${dataProvider.queryMatch.field} : ${
            isNumber(dataProvider.queryMatch.value)
              ? dataProvider.queryMatch.value
              : escapeQueryValue(dataProvider.queryMatch.value)
          }`
      : `${dataProvider.queryMatch.field} ${EXISTS_OPERATOR}`
  }`.trim();

const buildQueryForAndProvider = (
  dataAndProviders: DataProvidersAnd[],
  browserFields: BrowserFields
) =>
  dataAndProviders
    .reduce((andQuery, andDataProvider) => {
      const prepend = (q: string) => `${q !== '' ? `${q} and ` : ''}`;
      return andDataProvider.enabled
        ? `${prepend(andQuery)} ${buildQueryMatch(andDataProvider, browserFields)}`
        : andQuery;
    }, '')
    .trim();

export const buildGlobalQuery = (dataProviders: DataProvider[], browserFields: BrowserFields) =>
  dataProviders
    .reduce((query, dataProvider: DataProvider, i) => {
      const prepend = (q: string) => `${q !== '' ? `(${q}) or ` : ''}`;
      const openParen = i > 0 ? '(' : '';
      const closeParen = i > 0 ? ')' : '';
      return dataProvider.enabled
        ? `${prepend(query)}${openParen}${buildQueryMatch(dataProvider, browserFields)}
        ${
          dataProvider.and.length > 0
            ? ` and ${buildQueryForAndProvider(dataProvider.and, browserFields)}`
            : ''
        }${closeParen}`.trim()
        : query;
    }, '')
    .trim();

export const combineQueries = (
  dataProviders: DataProvider[],
  indexPattern: StaticIndexPattern,
  browserFields: BrowserFields,
  kqlQuery: string,
  kqlMode: string,
  start: number,
  end: number,
  isEventViewer?: boolean
): { filterQuery: string } | null => {
  let kuery: string;
  if (isEmpty(dataProviders) && isEmpty(kqlQuery) && !isEventViewer) {
    return null;
  } else if (isEmpty(dataProviders) && isEmpty(kqlQuery) && isEventViewer) {
    kuery = `@timestamp >= ${start} and @timestamp <= ${end}`;
    return {
      filterQuery: convertKueryToElasticSearchQuery(kuery, indexPattern),
    };
  } else if (isEmpty(dataProviders) && !isEmpty(kqlQuery)) {
    kuery = `(${kqlQuery}) and @timestamp >= ${start} and @timestamp <= ${end}`;
    return {
      filterQuery: convertKueryToElasticSearchQuery(kuery, indexPattern),
    };
  } else if (!isEmpty(dataProviders) && isEmpty(kqlQuery)) {
    kuery = `(${buildGlobalQuery(
      dataProviders,
      browserFields
    )}) and @timestamp >= ${start} and @timestamp <= ${end}`;
    return {
      filterQuery: convertKueryToElasticSearchQuery(kuery, indexPattern),
    };
  }
  const operatorKqlQuery = kqlMode === 'filter' ? 'and' : 'or';
  const postpend = (q: string) => `${!isEmpty(q) ? ` ${operatorKqlQuery} (${q})` : ''}`;
  kuery = `((${buildGlobalQuery(dataProviders, browserFields)})${postpend(
    kqlQuery
  )}) and @timestamp >= ${start} and @timestamp <= ${end}`;
  return {
    filterQuery: convertKueryToElasticSearchQuery(kuery, indexPattern),
  };
};

interface CalculateBodyHeightParams {
  /** The the height of the flyout container, which is typically the entire "page", not including the standard Kibana navigation */
  flyoutHeight?: number;
  /** The flyout header typically contains a title and a close button */
  flyoutHeaderHeight?: number;
  /** All non-body timeline content (i.e. the providers drag and drop area, and the column headers)  */
  timelineHeaderHeight?: number;
  /** Footer content that appears below the body (i.e. paging controls) */
  timelineFooterHeight?: number;
}

export const calculateBodyHeight = ({
  flyoutHeight = 0,
  flyoutHeaderHeight = 0,
  timelineHeaderHeight = 0,
  timelineFooterHeight = 0,
}: CalculateBodyHeightParams): number =>
  flyoutHeight - (flyoutHeaderHeight + timelineHeaderHeight + timelineFooterHeight);
