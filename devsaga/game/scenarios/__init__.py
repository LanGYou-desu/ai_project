"""场景注册表。新增场景：在这里导入并加入 ALL_SCENARIOS。"""

from .algo_arena import AlgoArena
from .container_storm import ContainerStorm
from .debug_detective import DebugDetective
from .frontend_magic import FrontendMagic
from .git_quest import GitQuest
from .network_sleuth import NetworkSleuth
from .pipeline_deploy import PipelineDeploy
from .security_fortress import SecurityFortress
from .sql_rescue import SqlRescue
from .sysadmin_er import SysadminER
from .terminal_master import TerminalMaster

ALL_SCENARIOS = [
    TerminalMaster,
    GitQuest,
    DebugDetective,
    SqlRescue,
    SysadminER,
    AlgoArena,
    NetworkSleuth,
    ContainerStorm,
    PipelineDeploy,
    FrontendMagic,
    SecurityFortress,
]

SCENARIO_MAP = {cls.id: cls for cls in ALL_SCENARIOS}


def list_scenarios():
    return [(cls.id, cls.name, cls.tagline.splitlines()[0], cls.difficulty) for cls in ALL_SCENARIOS]


def new_scenario(sid):
    cls = SCENARIO_MAP.get(sid)
    if cls is None:
        raise KeyError(f"未知场景：{sid}")
    return cls()
