/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { MetricAggParamEditor } from '../../controls/metric_agg';
import { SubAggParamEditor } from '../../controls/sub_agg';
import _ from 'lodash';
import { Schemas } from '../../../vis/editors/default/schemas';
import { parentPipelineAggWriter } from './parent_pipeline_agg_writer';
import { forwardModifyAggConfigOnSearchRequestStart } from './nested_agg_helpers';
import { i18n } from '@kbn/i18n';


const metricAggFilter = ['!top_hits', '!percentiles', '!percentile_ranks', '!median', '!std_dev', '!geo_bounds', '!geo_centroid'];
const metricAggSchema = (new Schemas([
  {
    group: 'none',
    name: 'metricAgg',
    title: i18n.translate('common.ui.aggTypes.metrics.metricAggTitle', {
      defaultMessage: 'Metric agg'
    }),
    hideCustomLabel: true,
    aggFilter: metricAggFilter
  }
])).all[0];

const parentPipelineAggHelper = {
  subtype: i18n.translate('common.ui.aggTypes.metrics.parentPipelineAggregationsSubtypeTitle', {
    defaultMessage: 'Parent Pipeline Aggregations'
  }),
  params: function () {
    return [
      {
        name: 'metricAgg',
        editorComponent: MetricAggParamEditor,
        default: 'custom',
        write: parentPipelineAggWriter
      },
      {
        name: 'customMetric',
        editorComponent: SubAggParamEditor,
        type: 'agg',
        default: null,
        makeAgg: function (termsAgg, state) {
          state = state || { type: 'count' };
          state.schema = metricAggSchema;
          const metricAgg = termsAgg.aggConfigs.createAggConfig(state, { addToAggConfigs: false });
          metricAgg.id = termsAgg.id + '-metric';
          return metricAgg;
        },
        modifyAggConfigOnSearchRequestStart: forwardModifyAggConfigOnSearchRequestStart('customMetric'),
        write: _.noop
      },
      {
        name: 'buckets_path',
        write: _.noop
      }
    ];
  },
  getFormat: function (agg) {
    let subAgg;
    if (agg.params.customMetric) {
      subAgg = agg.params.customMetric;
    } else {
      subAgg = agg.aggConfigs.byId(agg.params.metricAgg);
    }
    return subAgg.type.getFormat(subAgg);
  }
};
export { parentPipelineAggHelper };
