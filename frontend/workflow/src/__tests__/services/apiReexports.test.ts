import api from '../../services/api';
import priorityRulesApi from '../../services/priorityRulesApi';
import slaApi from '../../services/slaApi';

describe('api re-exports', () => {
  it('priorityRulesApi re-exports api instance', () => {
    expect(priorityRulesApi).toBe(api);
  });

  it('slaApi re-exports api instance', () => {
    expect(slaApi).toBe(api);
  });
});

