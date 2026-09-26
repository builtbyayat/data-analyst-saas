import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  DatasetsService,
} from './datasets.service.js';

describe('DatasetsService management', () => {
  let service: DatasetsService;

  const datasetRepository = {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    remove: vi.fn(),
  };

  const ingestionQueue = {
    add: vi.fn(),
  };

  const storageService = {
    delete: vi.fn(),
    upload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service =
      new DatasetsService(
        datasetRepository as never,
        ingestionQueue as never,
        storageService as never,
      );
  });

  it('lists workspace datasets with the default limit', async () => {
    datasetRepository.find.mockResolvedValue(
      [],
    );

    await service.listByWorkspace(
      'workspace-1',
    );

    expect(
      datasetRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });
  });

  it('caps the workspace dataset list at 100 items', async () => {
    datasetRepository.find.mockResolvedValue(
      [],
    );

    await service.listByWorkspace(
      'workspace-1',
      500,
    );

    expect(
      datasetRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('uses the default list limit for invalid values', async () => {
    datasetRepository.find.mockResolvedValue(
      [],
    );

    await service.listByWorkspace(
      'workspace-1',
      Number.NaN,
    );

    expect(
      datasetRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('rejects an empty dataset name while creating a dataset', async () => {
    await expect(
      service.createDataset(
        'workspace-1',
        '   ',
        'sales.csv',
        'object-key',
        'text/csv',
        '100',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      datasetRepository.create,
    ).not.toHaveBeenCalled();
  });

  it('trims and persists the dataset name during creation', async () => {
    const dataset = {
      id: 'dataset-1',
      workspaceId: 'workspace-1',
      name: 'Sales Data',
    };

    datasetRepository.create.mockReturnValue(
      dataset,
    );

    datasetRepository.save.mockResolvedValue(
      dataset,
    );

    ingestionQueue.add.mockResolvedValue(
      undefined,
    );

    const result =
      await service.createDataset(
        'workspace-1',
        '  Sales Data  ',
        'sales.csv',
        'object-key',
        'text/csv',
        '100',
      );

    expect(
      datasetRepository.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sales Data',
      }),
    );

    expect(
      ingestionQueue.add,
    ).toHaveBeenCalledWith(
      'process-dataset',
      {
        datasetId: 'dataset-1',
        workspaceId: 'workspace-1',
      },
    );

    expect(result).toEqual(
      dataset,
    );
  });

  it('renames a dataset within the workspace scope', async () => {
    const dataset = {
      id: 'dataset-1',
      workspaceId: 'workspace-1',
      name: 'Old Name',
    };

    datasetRepository.findOne.mockResolvedValue(
      dataset,
    );

    datasetRepository.save.mockImplementation(
      async (value) => value,
    );

    const result =
      await service.updateDataset(
        'dataset-1',
        'workspace-1',
        {
          name: '  New Name  ',
        },
      );

    expect(
      datasetRepository.findOne,
    ).toHaveBeenCalledWith({
      where: {
        id: 'dataset-1',
        workspaceId: 'workspace-1',
      },
    });

    expect(dataset.name).toBe(
      'New Name',
    );

    expect(
      result.name,
    ).toBe('New Name');
  });

  it('rejects an empty dataset name during update', async () => {
    const dataset = {
      id: 'dataset-1',
      workspaceId: 'workspace-1',
      name: 'Old Name',
    };

    datasetRepository.findOne.mockResolvedValue(
      dataset,
    );

    await expect(
      service.updateDataset(
        'dataset-1',
        'workspace-1',
        {
          name: '   ',
        },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      datasetRepository.save,
    ).not.toHaveBeenCalled();
  });

  it('does not update a dataset outside the workspace scope', async () => {
    datasetRepository.findOne.mockResolvedValue(
      null,
    );

    await expect(
      service.updateDataset(
        'dataset-1',
        'workspace-2',
        {
          name: 'New Name',
        },
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cleans up a newly created dataset when queueing ingestion fails', async () => {
    const dataset = {
      id: 'dataset-1',
      workspaceId: 'workspace-1',
      name: 'Sales Data',
    };

    datasetRepository.create.mockReturnValue(
      dataset,
    );

    datasetRepository.save.mockResolvedValue(
      dataset,
    );

    ingestionQueue.add.mockRejectedValue(
      new Error(
        'Redis unavailable',
      ),
    );

    datasetRepository.delete.mockResolvedValue({
      affected: 1,
    });

    await expect(
      service.createDataset(
        'workspace-1',
        'Sales Data',
        'sales.csv',
        'object-key',
        'text/csv',
        '100',
      ),
    ).rejects.toThrow(
      'Redis unavailable',
    );

    expect(
      datasetRepository.delete,
    ).toHaveBeenCalledWith({
      id: 'dataset-1',
      workspaceId:
        'workspace-1',
    });
  });
});